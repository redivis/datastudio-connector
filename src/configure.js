function getConfig() {
	const config = cc.getConfig();

	config
		.newInfo()
		.setId('generalInfo')
		.setText('The Redivis data studio connector allows you to visualize data resources in Redivis.');

	config
		.newInfo()
		.setId('otherInfo')
		.setText(
			'Please note that some data owners may prevent their data from being used in DataStudio (in which case, attempts to reference the data will provide an error notification).'
		);

	config
		.newTextInput()
		.setId('owner')
		.setName('Dataset or project owner')
		.setHelpText('Provide the user or organization short name for the owner of the dataset or project')
		.setPlaceholder('user_name');

	config
		.newTextInput()
		.setId('parent')
		.setName('Dataset or project reference')
		.setHelpText('See apidocs.redivis.com to learn more about referencing resources')
		.setPlaceholder('dataset_name or project_name');

	config
		.newTextInput()
		.setId('table')
		.setName('Table reference')
		.setHelpText('See apidocs.redivis.com to learn more about referencing resources')
		.setPlaceholder('table_name');
	return config.build();
}
