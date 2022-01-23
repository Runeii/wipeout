import React, { useEffect, useRef, useState } from 'react';
import { createTrack } from '../utils/modelUtils';

const useTrack = (files) => {
	const initialObj = useRef(files);
	const [track, setTrack] = useState(null);

	useEffect(() => {
		createTrack(initialObj.current)
			.then(setTrack)
			.catch(console.error);
	}, []);

	return track;
}

export default useTrack;