import React from 'react';
import useModels from '../hooks/useModels';

const Model = ({ files, ...rest }) => {
	const models = useModels(files);

	if (!models) {
		return null;
	}

	return models.map(({ geometry, id, materials, position }) => (
		<group position={position} key={id} {...rest}>
			<mesh>
				<bufferGeometry {...geometry} />
				{materials.map(material => <meshBasicMaterial attachArray="material" key={material.id} {...material} />)}
			</mesh>
		</group >
	));
}
export default Model;