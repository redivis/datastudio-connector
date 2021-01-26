function isAdminUser() {
	return Session.getActiveUser().getEmail() === 'ian@redivis.com';
}

function getAuthType() {
	return DataStudioApp.createCommunityConnector().newAuthTypeResponse().setAuthType(cc.AuthType.OAUTH2).build();
}

function resetAuth() {
	getOAuthService().reset();
}

function isAuthValid() {
	if (getOAuthService().hasAccess() === false) {
		return false;
	}
	const response = UrlFetchApp.fetch(
		`${baseUrl}/api/v1/dataStudio/validateAuth?email=${encodeURIComponent(Session.getEffectiveUser().getEmail())}`,
		{
			method: 'GET',
			headers: {
				Authorization: `Bearer ${getOAuthService().getAccessToken()}`,
			},
			muteHttpExceptions: true,
		}
	);
	return checkAPIResponseForErrorMessage(response, false);
}

function getOAuthService() {
	return OAuth2.createService('redivis')
		.setAuthorizationBaseUrl(`${baseUrl}/oauth/authorize`)
		.setTokenUrl(`${baseUrl}/oauth/token`)
		.setClientId(scriptProperties.getProperty('REDIVIS_CLIENT_ID'))
		.setClientSecret(scriptProperties.getProperty('REDIVIS_CLIENT_SECRET'))
		.setPropertyStore(PropertiesService.getUserProperties())
		.setCache(CacheService.getUserCache())
		.setCallbackFunction('authCallback')
		.setScope('data.data')
		.setParam('access_type', 'offline');
}

function authCallback(request) {
	const authorized = getOAuthService().handleCallback(request);
	if (authorized) {
		return HtmlService.createHtmlOutput('Authentication with DataStudio was successful. You can close this tab.');
	} else {
		return HtmlService.createHtmlOutput('Access Denied. You can close this tab.');
	}
}

function get3PAuthorizationUrls() {
	return getOAuthService().getAuthorizationUrl();
}
