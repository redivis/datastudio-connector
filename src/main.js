const cc = DataStudioApp.createCommunityConnector();
const scriptProperties = PropertiesService.getScriptProperties();
const baseUrl = 'https://redivis.com';

function checkAPIResponseForErrorMessage(response, throwError = true) {
	if (response.getResponseCode() >= 400) {
		const errorPayload = JSON.parse(response.getContentText());
		let errorMessage;
		if (response.getResponseCode() === 401) {
			resetAuth();
			// PropertiesService.getUserProperties().setProperty('shouldReauthenticate', 'true');
			errorMessage = `Please reload this page to re-authenticate your Redivis account. Error details: \n\n${errorPayload.error.message}`;
		} else {
			errorMessage = 'An API error occurred: ' + errorPayload.error.message;
		}
		if (throwError) {
			cc.newUserError().setText(errorMessage).throwException();
		} else {
			return false;
		}
	}
	return true;
}

function getQuery(request, fields) {
	if (!request.configParams) {
		cc.newUserError().setText('Please fill out the table connection configuration.').throwException();
	}
	const { owner, parent, table } = request.configParams;
	if (!owner || !owner.trim()) {
		cc.newUserError().setText('You must provide the username of the dataset or project owner.').throwException();
	}
	if (!parent || !parent.trim()) {
		cc.newUserError().setText('You must provide the name of the dataset or project.').throwException();
	}
	if (!table || !table.trim()) {
		cc.newUserError().setText('You must provide the name of the table.').throwException();
	}

	if (fields && fields.length) {
		fields = fields.map((field) => `\`${field.name}\``).join(', ');
	} else {
		fields = '*';
	}

	return `SELECT ${fields} FROM \`${owner}.${parent}.${table}\``;
}

function getServiceAccountCreds() {
	return JSON.parse(scriptProperties.getProperty('SERVICE_ACCOUNT_CREDS'));
}

function getBigQueryAccessToken() {
	const serviceAccountCreds = getServiceAccountCreds();
	const scriptCache = CacheService.getScriptCache();

	let service = OAuth2.createService('DataStudio')
		.setAuthorizationBaseUrl('https://accounts.google.com/o/oauth2/auth')
		.setTokenUrl('https://accounts.google.com/o/oauth2/token')
		.setPrivateKey(serviceAccountCreds.private_key)
		.setIssuer(serviceAccountCreds.client_email)
		.setPropertyStore(scriptProperties)
		.setCache(scriptCache)
		.setScope(['https://www.googleapis.com/auth/bigquery.readonly']);

	if (service.hasAccess()) {
		return service.getAccessToken();
	} else {
		// Delete from property store if there was an auth error (likely due to expired token)
		// Only attempt this on first error to avoid infinite recursion
		service.reset();
		scriptProperties.deleteProperty('oauth2.DataStudio');
		scriptCache.remove('oauth2.DataStudio');
		service = OAuth2.createService('DataStudio')
			.setAuthorizationBaseUrl('https://accounts.google.com/o/oauth2/auth')
			.setTokenUrl('https://accounts.google.com/o/oauth2/token')
			.setPrivateKey(serviceAccountCreds.private_key)
			.setIssuer(serviceAccountCreds.client_email)
			// .setPropertyStore(scriptProperties) // For some reason this was causing issues...
			.setCache(scriptCache)
			.setScope(['https://www.googleapis.com/auth/bigquery.readonly']);

		return service.getAccessToken();
	}
}

function getQueryConfig(request) {
	const serviceAccountCreds = getServiceAccountCreds();
	const accessToken = getBigQueryAccessToken();

	const query = encodeURIComponent(getQuery(request, request.fields));

	const response = UrlFetchApp.fetch(`${baseUrl}/api/v1/dataStudio/getDataQuery?query=${query}`, {
		method: 'get',
		headers: {
			Authorization: `Bearer ${getOAuthService().getAccessToken()}`,
		},
		muteHttpExceptions: true,
	});

	checkAPIResponseForErrorMessage(response);

	return cc
		.newBigQueryConfig()
		.setBillingProjectId(serviceAccountCreds.project_id)
		.setQuery(JSON.parse(response.getContentText()).parsedQuery)
		.setUseStandardSql(true)
		.setAccessToken(accessToken)
		.build();
}

function getSchema(request) {
	return getQueryConfig(request);
}

function getData(request) {
	return getQueryConfig(request);
}
