import './Header.css'
import { Layout } from 'antd'
import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import UserDropdown from './UserDropdown'
import { useAuth } from '../../hooks/useAuth'

const { Header: AntHeader } = Layout

type HeaderVariant = 'default' | 'rounded'

interface HeaderProps {
	variant?: HeaderVariant
	showLogo?: boolean
	showUserAvatar?: boolean
	/** Скрыть пункт «Мой профиль» в меню пользователя (например, для суперпользователя) */
	hideProfileLink?: boolean
	/** Куда ведёт клик по логотипу */
	logoTo?: string
}

export default function Header({
	variant = 'default',
	showLogo = true,
	showUserAvatar = false,
	hideProfileLink = false,
	logoTo = '/',
}: HeaderProps) {
	const { isAuthenticated, logout, isRestoring, getUserName } = useAuth()
	const [userName, setUserName] = useState<string>('')

	useEffect(() => {
		if (isAuthenticated) {
			setUserName(getUserName())
		}
	}, [isAuthenticated, getUserName])

	const headerClassName = `header ${
		variant === 'rounded' ? 'header--rounded' : ''
	}`

	const handleLogout = () => {
		logout()
	}

	const shouldShowUserAvatar = !isRestoring && showUserAvatar && isAuthenticated

	return (
		<AntHeader className={headerClassName}>
			<div className='header__left'>
				{showLogo && (
					<Link to={logoTo} className='header__logo-link'>
						<span className='header__logo header__logo-text'>atomskills</span>
					</Link>
				)}

				{isAuthenticated && <Link to='/files/my' className='header__files-link'>Файловое хранилище</Link>}
			</div>

			<div className='header__rightButtons'>
				{shouldShowUserAvatar ? (
					<UserDropdown
						fullName={userName || 'Пользователь'}
						mesAm={0}
						onLogout={handleLogout}
						hideProfileLink={hideProfileLink}
					/>
				) : null}
			</div>
		</AntHeader>
	)
}
