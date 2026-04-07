import React from 'react'
import { Button as AntdButton } from 'antd'

interface FormButtonProps {
	title: React.ReactNode
	type?: 'primary' | 'default' | 'dashed' | 'text' | 'link'
	size?: 'small' | 'middle' | 'large'
	htmlType?: 'button' | 'submit' | 'reset'
	disabled?: boolean
	loading?: boolean
	icon?: React.ReactNode
	style?: React.CSSProperties
	className?: string
	onClick?: () => void
}

const FormButton: React.FC<FormButtonProps> = ({
	title,
	type = 'default',
	size = 'middle',
	htmlType = 'button',
	disabled = false,
	loading = false,
	icon,
	style,
	className,
	onClick,
}) => {
	return (
		<AntdButton
			type={type}
			size={size}
			htmlType={htmlType}
			disabled={disabled || loading}
			icon={icon}
			style={style}
			className={className}
			onClick={onClick}
			loading={loading}
		>
			{title}
		</AntdButton>
	)
}

export default FormButton
