import React, { useEffect, useRef, useState } from 'react';
import { createModels } from '../utils/modelUtils';

const useModels = (files, onCreateCallback = null) => {
	const initialObj = useRef(files);
	const [model, setModel] = useState(null);
	useEffect(() => {
		createModels(initialObj.current).then(output => {
			if (onCreateCallback) {
				setModel(onCreateCallback(output))
				return;
			}
			setModel(output)
		}).catch(console.error);
	}, []);

	return model;
}

export default useModels;