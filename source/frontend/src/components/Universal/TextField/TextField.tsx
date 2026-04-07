import { Input, Form } from 'antd'
import { EyeInvisibleOutlined, EyeTwoTone } from '@ant-design/icons'

const { Item } = Form
const { Password } = Input

interface TextFieldProps {
	name: string
	status?: 'error' | 'warning'
	label?: string
	errorText?: string
	disabled?: boolean
	isPassword?: boolean
	onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
	onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void
	onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void
	placeholder?: string
	prefix?: React.ReactNode
	suffix?: React.ReactNode
	rules?: any[]
}

const TextField = ({
	name,
	status,
	label,
	errorText,
	disabled = false,
	isPassword = false,
	onChange,
	onFocus,
	onBlur,
	placeholder,
	prefix,
	suffix,
	rules,
}: TextFieldProps) => {
	return (
		<Item
			name={name}
			label={label}
			validateStatus={status}
			help={errorText ?? null}
			rules={rules}
		>
			{isPassword ? (
				<Password
					size='large'
					status={status}
					onChange={onChange}
					onFocus={onFocus}
					onBlur={onBlur}
					placeholder={placeholder}
					prefix={prefix}
					suffix={suffix}
					iconRender={visible =>
						visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />
					}
					style={{ borderRadius: '22px' }}
				/>
			) : (
				<Input
					size='large'
					status={status}
					onChange={onChange}
					onFocus={onFocus}
					onBlur={onBlur}
					disabled={disabled}
					placeholder={placeholder}
					prefix={prefix}
					suffix={suffix}
					style={{ borderRadius: '22px' }}
				/>
			)}
		</Item>
	)
}

export default TextField
