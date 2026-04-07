import React from 'react'
import './WidthControl.css'

interface WidthControlProps {
	children: React.ReactNode
	className?: string
	style?: React.CSSProperties
}

export const WidthControl: React.FC<WidthControlProps> = ({
	children,
	className = '',
	style = {},
}) => {
	return (
		<div className={`width-control ${className}`} style={style}>
			<div className='width-control__inner'>{children}</div>
		</div>
	)
}
