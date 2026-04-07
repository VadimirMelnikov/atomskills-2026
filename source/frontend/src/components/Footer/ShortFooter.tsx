import React from 'react'

interface ShortFooterProps {
	className?: string
}

const footerStyles: React.CSSProperties = {
	textAlign: 'center',
	marginTop: '32px',
	color: '#8c8c8c',
	fontSize: '14px',
	padding: '20px 0',
	borderTop: '1px solid #f0f0f0',
}

const ShortFooter: React.FC<ShortFooterProps> = ({ className }) => {
	const currentYear = new Date().getFullYear()

	return (
		<div className={className} style={footerStyles}>
			© {currentYear} Atomskills
		</div>
	)
}

export default ShortFooter
