import { OrbitControls } from '@react-three/drei';
import React from 'react'
import Model from "./components/Model";
import Sky from './components/Sky';
import Track from './components/Track';
import { TRACKS_WIPEOUT2097 } from './CONSTANTS';

const App = () => {
	const track = TRACKS_WIPEOUT2097[0];
	const { path } = track;
	return (
		<>
			<OrbitControls />
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
			/>
		</>
	);
}

export default App;