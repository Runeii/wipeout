import React from 'react'
import { PerspectiveCamera } from "@react-three/drei";
import { Vector3 } from "three";
import Sky from "./components/Sky";
import { TRACKS_WIPEOUT2097 } from './CONSTANTS';

const App = () => {
	const track = TRACKS_WIPEOUT2097[0];
	return (
		<>
			<PerspectiveCamera makeDefault lookAt={new Vector3(0, 0, 0)} />
			<Sky track={track} />
		</>
	);
}

export default App;