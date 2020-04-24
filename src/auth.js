function isAdminUser() {
	return Session.getActiveUser().getEmail() === 'ian@redivis.com';
}

function getAuthType() {
	return cc
		.newAuthTypeResponse()
		.setAuthType(cc.AuthType.KEY)
		.setHelpUrl('https://apidocs.redivis.com/authorization')
		.build();
}

function setCredentials(request) {
	if (!validateKey(request.key)) {
		return {
			errorCode: 'INVALID_CREDENTIALS',
		};
	}
	PropertiesService.getUserProperties().setProperty('dscc.key', request.key);
	return {
		errorCode: 'NONE',
	};
}

function isAuthValid() {
	if (PropertiesService.getUserProperties().getProperty('requires_login')) {
		return validateKey(PropertiesService.getUserProperties().getProperty('dscc.key'));
	}

	return true
}

function validateKey(key) {
	var response = UrlFetchApp.fetch(
		'https://redivis.com/api/v1/dataStudio/validateAuth?email=' +
			encodeURIComponent(Session.getEffectiveUser().getEmail()),
		{
			method: 'GET',
			headers: { Authorization: 'Bearer ' + key },
			muteHttpExceptions: true,
		}
	);

	return response.getResponseCode() < 400;
}

function resetAuth() {
	PropertiesService.getUserProperties().deleteProperty('dscc.key');
}
