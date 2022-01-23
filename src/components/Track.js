import React from 'react';
import useTrack from '../hooks/useTrack';

const Track = ({ files, ...rest }) => {
	const track = useTrack(files);

	if (!track) {
		return null;
	}

	const { geometry, id, materials } = track;

	return (
		<group key={id} {...rest}>
			<mesh>
				<bufferGeometry {...geometry} />
				{materials.map(material => <meshBasicMaterial attachArray="material" key={material.id} {...material} />)}
			</mesh>
		</group >
	);
}
export default Track;