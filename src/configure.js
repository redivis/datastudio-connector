function getConfig() {
	const config = cc.getConfig();

	config
		.newInfo()
		.setId('generalInfo')
		.setText(
			'Specify connection information for your Redivis table below. Full documentation for connecting with DataStudio is available at https://docs.redivis.com/reference/export-and-integrations/data-studio'
		);

	config
		.newTextInput()
		.setId('owner')
		.setName('Username of dataset / project owner')
		.setHelpText('Provide the username of the user or organization that owns this dataset / project');

	config
		.newTextInput()
		.setId('parent')
		.setName('Dataset / project name')
		.setHelpText('Case insensitive name of the table. Non-word characters can be replaced by an underscore "_"');

	config
		.newTextInput()
		.setId('table')
		.setName('Table name')
		.setHelpText('Case insensitive name of the table. Non-word characters can be replaced by an underscore "_"');

	return config.build();
}
