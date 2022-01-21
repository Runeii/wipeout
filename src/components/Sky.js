import React, { useEffect } from 'react';
import useModels from '../hooks/useModel';

const Sky = ({ track }) => {
	const sky = useModels({
		textures: track.path + '/SKY.CMP',
		objects: track.path + '/SKY.PRM'
	}, ([model]) => {
		model.scale.set(48, 48, 48);
		return model;
	});

	if (!sky) {
		return null;
	}

	console.log(sky)
	return <primitive object={sky} />
}

export default Sky;