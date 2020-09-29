var cc = DataStudioApp.createCommunityConnector();
var scriptProperties = PropertiesService.getScriptProperties();

var typeMap = {
	date: cc.FieldType.YEAR_MONTH_DAY,
	dateTime: cc.FieldType.YEAR_MONTH_DAY,
	// dateTime: cc.FieldType.YEAR_MONTH_DAY_SECOND,
	integer: cc.FieldType.NUMBER,
	float: cc.FieldType.NUMBER,
	string: cc.FieldType.TEXT,
	time: cc.FieldType.TEXT,
	boolean: cc.FieldType.BOOLEAN,
};

function checkAPIResponseForErrorMessage(response) {
	try {

		if (response.getResponseCode() === 401 || response.getResponseCode() === 403){
			PropertiesService.getUserProperties().setProperty('requires_login', true);
		}
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
		var field;

		if (variable.type === 'date'){
			fields
				.newDimension()
				.setType(typeMap['string'])
				.setId(variable.name)
				.setName('__' + variable.name)
				.setIsHidden(true);

			field = fields
				.newDimension()
				.setId('__'+variable.name)
				.setName(variable.name)
				.setType(typeMap[variable.type])
				.setFormula("REGEXP_REPLACE(" + variable.name + ", '-', '')")
		} else if (variable.type === 'dateTime'){
			fields
				.newDimension()
				.setType(typeMap['string'])
				.setId(variable.name)
				.setName('__' + variable.name)
				.setIsHidden(true);

			field = fields
				.newDimension()
				.setId('__'+variable.name)
				.setName(variable.name)
				.setType(typeMap[variable.type])
				.setFormula("REGEXP_REPLACE(" + variable.name + ", '-| .*', '')")
		} else {
			 field = fields
				.newDimension()
				.setId(variable.name)
				.setName(variable.name)
				.setType(typeMap[variable.type]);
		}

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
	PropertiesService.getUserProperties().deleteProperty('requires_login');

	const headers = {};
	if (PropertiesService.getUserProperties().getProperty('dscc.key')){
		headers.Authorization = 'Bearer ' + PropertiesService.getUserProperties().getProperty('dscc.key')
	}

	var response = UrlFetchApp.fetch(
		'https://redivis.com/api/v1/dataStudio/getSchema?query=' + encodeURIComponent(getQuery(request)),
		{
			method: 'get',
			headers: headers,
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
	var scriptCache = CacheService.getScriptCache()

	var service = OAuth2.createService('DataStudio')
		.setAuthorizationBaseUrl('https://accounts.google.com/o/oauth2/auth')
		.setTokenUrl('https://accounts.google.com/o/oauth2/token')
		.setPrivateKey(serviceAccountCreds.private_key)
		.setIssuer(serviceAccountCreds.client_email)
		.setPropertyStore(scriptProperties)
		.setCache(scriptCache)
		.setScope(['https://www.googleapis.com/auth/bigquery.readonly']);

	if (service.hasAccess()){
		return service
	} else {
		// Delete from property store if there was an auth error (likely due to expired token)
		// Only attempt this on first error to avoid infinite recursion
		// cc.newUserError()
		// 	.setText('Has no access')
		// 	.throwException();
		service.reset();
		scriptProperties.deleteProperty('oauth2.DataStudio')
		scriptCache.remove('oauth2.DataStudio')
		return OAuth2.createService('DataStudio')
			.setAuthorizationBaseUrl('https://accounts.google.com/o/oauth2/auth')
			.setTokenUrl('https://accounts.google.com/o/oauth2/token')
			.setPrivateKey(serviceAccountCreds.private_key)
			.setIssuer(serviceAccountCreds.client_email)
			// .setPropertyStore(scriptProperties) // For some reason this was causing issues...
			.setCache(scriptCache)
			.setScope(['https://www.googleapis.com/auth/bigquery.readonly']);
	}
}

function getData(request) {
	PropertiesService.getUserProperties().deleteProperty('requires_login');

	var serviceAccountCreds = getServiceAccountCreds();
	var oAuthService = getOauthService();
	var accessToken = oAuthService.getAccessToken();

	const headers = {};
	if (PropertiesService.getUserProperties().getProperty('dscc.key')){
		headers.Authorization = 'Bearer ' + PropertiesService.getUserProperties().getProperty('dscc.key')
	}

	var response = UrlFetchApp.fetch(
		'https://redivis.com/api/v1/dataStudio/getDataQuery?query=' +
			encodeURIComponent(getQuery(request, request.fields)),
		{
			method: 'get',
			headers: headers,
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
			// TODO: this is testing the BI Engine stuff. Also need to remove from BQ
			// .setQuery('SELECT * FROM som-phs-redivis-prod.dataset_1527.test')
			.build()
	);
}

