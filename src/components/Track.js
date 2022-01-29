import React, { useEffect } from 'react';
import useTrack from '../hooks/useTrack';

const Track = ({ files, setCameraSpline, ...rest }) => {
	const track = useTrack(files);

	useEffect(() => {
		if (!track) {
			return;
		}

		setCameraSpline(track.cameraSpline);
	}, [track]);

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