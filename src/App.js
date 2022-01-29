import { OrbitControls } from '@react-three/drei';
import React, { useState } from 'react'
import Camera from './components/Camera';
import Model from "./components/Model";
import Sky from './components/Sky';
import Track from './components/Track';
import { TRACKS_WIPEOUT2097 } from './CONSTANTS';

const App = () => {
	const track = TRACKS_WIPEOUT2097[2];
	const { path } = track;

	const [cameraSpline, setCameraSpline] = useState(null);

	return (
		<>
			{/*			<OrbitControls /> */}
			<Model
				files={{
					textures: path + '/SCENE.CMP',
					objects: path + '/SCENE.PRM'
				}}
			/>
			<Sky track={track} />
			<Track
				files={{
					textures: path + '/LIBRARY.CMP',
					textureIndex: path + '/LIBRARY.TTF',
					vertices: path + '/TRACK.TRV',
					faces: path + '/TRACK.TRF',
					sections: path + '/TRACK.TRS'
				}}
				setCameraSpline={setCameraSpline}
			/>
			<Camera cameraSpline={cameraSpline} />
		</>
	);
}

export default App;