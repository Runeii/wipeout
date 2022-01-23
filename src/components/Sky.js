import React, { useEffect, useRef } from 'react';
import useModels from '../hooks/useModels';

const Sky = ({ track }) => {
	const models = useModels({
		textures: track.path + '/SKY.CMP',
		objects: track.path + '/SKY.PRM'
	});

	if (!models) {
		return null;
	}

	const model = models[0];
	return (
		<group position={model.position}>
			<mesh scale={48}>
				<bufferGeometry {...model.geometry} />
				{model.materials.map(material => <meshBasicMaterial attachArray="material" key={material.id} {...material} />)}
			</mesh>
		</group >
	)
}
export default Sky;