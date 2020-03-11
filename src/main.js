var cc = DataStudioApp.createCommunityConnector();
var scriptProperties = PropertiesService.getScriptProperties();

function isAdminUser() {
  return true;
}

function getAuthType() {
  var AuthTypes = cc.AuthType;
  return cc
    .newAuthTypeResponse()
    .setAuthType(AuthTypes.NONE)
    .build();
}

function getConfig(request) {
  var config = cc.getConfig();

  config
    .newInfo()
    .setId("generalInfo")
    .setText("This is an example connector to showcase row level security.");

  return config.build();
}

function getFields() {
  var fields = cc.getFields();
  var types = cc.FieldType;

  fields
    .newDimension()
    .setId("id")
    .setName("id")
    .setType(types.NUMBER);

  return fields;
}

function getSchema(request) {
  return { schema: getFields().build() };
}

var SERVICE_ACCOUNT_CREDS = "SERVICE_ACCOUNT_CREDS";
var SERVICE_ACCOUNT_KEY = "private_key";
var SERVICE_ACCOUNT_EMAIL = "client_email";
var BILLING_PROJECT_ID = "project_id";

function getServiceAccountCreds() {
  return JSON.parse(scriptProperties.getProperty(SERVICE_ACCOUNT_CREDS));
}

function getOauthService() {
  var serviceAccountCreds = getServiceAccountCreds();
  var serviceAccountKey = serviceAccountCreds[SERVICE_ACCOUNT_KEY];
  var serviceAccountEmail = serviceAccountCreds[SERVICE_ACCOUNT_EMAIL];

  return OAuth2.createService("DataStudio")
    .setAuthorizationBaseUrl("https://accounts.google.com/o/oauth2/auth")
    .setTokenUrl("https://accounts.google.com/o/oauth2/token")
    .setPrivateKey(serviceAccountKey)
    .setIssuer(serviceAccountEmail)
    .setPropertyStore(scriptProperties)
    .setCache(CacheService.getScriptCache())
    .setScope(["https://www.googleapis.com/auth/bigquery.readonly"]);
}

var BASE_SQL =
  "SELECT * FROM `som-phs-redivis-dev.dataset_1521.60753`";

function getData(request) {
  var serviceAccountCreds = getServiceAccountCreds();
  var accessToken = getOauthService().getAccessToken();

  var bqTypes = DataStudioApp.createCommunityConnector().BigQueryParameterType;

  return cc
    .newBigQueryConfig()
    .setAccessToken(accessToken)
    .setBillingProjectId(serviceAccountCreds[BILLING_PROJECT_ID])
    .setUseStandardSql(true)
    .setQuery(BASE_SQL)
    .build();
}
