var cc = DataStudioApp.createCommunityConnector();
var scriptProperties = PropertiesService.getScriptProperties();

var typeMap = {
	date: cc.FieldType.YEAR_MONTH_DAY,
	dateTime: cc.FieldType.YEAR_MONTH_DAY_SECOND,
	integer: cc.FieldType.NUMBER,
	float: cc.FieldType.NUMBER,
	string: cc.FieldType.TEXT,
	time: cc.FieldType.TEXT,
	boolean: cc.FieldType.BOOLEAN,
};

function checkAPIResponseForErrorMessage(response) {
	try {
		if (response.getResponseCode() >= 400) {
			cc.newUserError()
				.setText('An API error occurred: ' + JSON.parse(response.getContentText()).error.message)
				.throwException();
		}
	} catch (e) {
		cc.newUserError()
			.setText(response.getContentText())
			.throwException();
	}
}

function getFields(variables) {
	var fields = cc.getFields();

	variables.forEach(function(variable) {
		var field = fields
			.newDimension()
			.setId(variable.name)
			.setName(variable.name)
			.setType(typeMap[variable.type]);
		if (variable.label) {
			field.setDescription(variable.label);
		}
	});

	return fields;
}

function getQuery(request, fields) {
	if (!request.configParams) {
		cc.newUserError()
			.setText('Please fill out the table connection configuration.')
			.throwException();
	}
	if (request.configParams.customQuery) {
		if (!request.configParams.query || !request.configParams.query.trim()) {
			cc.newUserError()
				.setText('You must provide a valid query.')
				.throwException();
		}
	} else {
		if (!request.configParams.owner || !request.configParams.owner.trim()) {
			cc.newUserError()
				.setText('You must provide a dataset or project owner.')
				.throwException();
		}
		if (!request.configParams.parent || !request.configParams.parent.trim()) {
			cc.newUserError()
				.setText('You must provide the name of the dataset or project.')
				.throwException();
		}
		if (!request.configParams.table || !request.configParams.table.trim()) {
			cc.newUserError()
				.setText('You must provide the name of the table.')
				.throwException();
		}
	}

	var query = request.configParams.query;
	if (!query) {
		query = [
			'SELECT * FROM `',
			request.configParams.owner,
			'.',
			request.configParams.parent,
			'.',
			request.configParams.table + '`',
		].join('');
	}
	if (fields && fields.length) {
		query =
			'SELECT ' +
			fields.map(function(field) {
				return '`' + field.name + '`';
			}) +
			' FROM (' +
			query +
			')';
	}
	return query;
}

function getSchema(request) {
	var response = UrlFetchApp.fetch(
		'https://redivis.com/api/v1/dataStudio/getSchema?query=' + encodeURIComponent(getQuery(request)),
		{
			method: 'get',
			headers: { Authorization: 'Bearer ' + PropertiesService.getUserProperties().getProperty('dscc.key') },
			muteHttpExceptions: true,
		}
	);

	checkAPIResponseForErrorMessage(response);

	return { schema: getFields(JSON.parse(response.getContentText()).variables).build() };
}

function getServiceAccountCreds() {
	return JSON.parse(scriptProperties.getProperty('SERVICE_ACCOUNT_CREDS'));
}

function getOauthService() {
	var serviceAccountCreds = getServiceAccountCreds();

	return OAuth2.createService('DataStudio')
		.setAuthorizationBaseUrl('https://accounts.google.com/o/oauth2/auth')
		.setTokenUrl('https://accounts.google.com/o/oauth2/token')
		.setPrivateKey(serviceAccountCreds.private_key)
		.setIssuer(serviceAccountCreds.client_email)
		.setPropertyStore(scriptProperties)
		.setCache(CacheService.getScriptCache())
		.setScope(['https://www.googleapis.com/auth/bigquery.readonly']);
}

function getData(request) {
	var serviceAccountCreds = getServiceAccountCreds();
	var accessToken = getOauthService().getAccessToken();

	var response = UrlFetchApp.fetch(
		'https://redivis.com/api/v1/dataStudio/getDataQuery?query=' +
			encodeURIComponent(getQuery(request, request.fields)),
		{
			method: 'get',
			headers: { Authorization: 'Bearer ' + PropertiesService.getUserProperties().getProperty('dscc.key') },
			muteHttpExceptions: true,
		}
	);

	checkAPIResponseForErrorMessage(response);

	return (
		cc
			.newBigQueryConfig()
			.setAccessToken(accessToken)
			.setBillingProjectId(serviceAccountCreds.project_id)
			.setUseStandardSql(true)
			.setQuery(JSON.parse(response.getContentText()).parsedQuery)
			// .setQuery('SELECT * FROM som-phs-redivis-prod.dataset_1527.test')
			.build()
	);
}
