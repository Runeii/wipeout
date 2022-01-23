import React, { useEffect, useRef, useState } from 'react';
import { createModel } from '../utils/modelUtils';

const useModels = (files) => {
	const initialObj = useRef(files);
	const [models, setModels] = useState(null);

	useEffect(() => {
		createModel(initialObj.current)
			.then(setModels)
			.catch(console.error);
	}, []);

	return models;
}

export default useModels;