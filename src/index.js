import React from 'react'
import { render, events } from '@react-three/fiber'
import App from './App';

const renderApp = () => render(
	<App />,
	document.getElementById('target'),
	{
		camera: null,
		events,
		size: {
			width: window.innerWidth,
			height: window.innerHeight
		},
	}
);

window.addEventListener('resize', renderApp)

renderApp();

