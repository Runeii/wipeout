export const loadBinaries = async (urls) => {
	const files = await Promise.all(
		Object.entries(urls).map(
			async ([name, url]) => {
				const response = await fetch(url);
				return [name, await response.arrayBuffer()]
			}
		)
	);
	return Object.fromEntries(files);
};
