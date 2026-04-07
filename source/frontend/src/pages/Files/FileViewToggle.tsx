import React, { useState } from 'react'
import {
	Segmented,
	Space,
	Typography,
	Tag,
	List,
	Card,
	Tooltip,
	Input,
	Button,
	Checkbox,
} from 'antd'
import {
	FolderOutlined,
	FileWordOutlined,
	FilePdfOutlined,
	FileImageOutlined,
	FileExcelOutlined,
	FileTextOutlined,
	FilePptOutlined,
	FileZipOutlined,
	FileUnknownOutlined,
	FileOutlined,
	SearchOutlined,
	PlusOutlined,
	UploadOutlined,
} from '@ant-design/icons'

const { Text } = Typography

import type { FileItem } from '../../types/file.type'

/** Уникальный ключ строки «На согласовании»: один документ может иметь несколько версий в списке. */
function approvalRowKey(file: FileItem, index: number): string {
	if (file.versionId != null) {
		return `approval-${file.id}-${file.versionId}`
	}
	return `approval-${file.id}-i${index}-v${file.version ?? '—'}-${file.status}`
}

const ApproverDecisionText: React.FC<{
	approved: boolean | null | undefined
}> = ({ approved }) => {
	if (approved === true) {
		return <Text style={{ color: '#52c41a' }}>Вы согласовали</Text>
	}
	if (approved === false) {
		return <Text style={{ color: '#ff4d4f' }}>Вы не согласовали</Text>
	}
	return <Text style={{ color: '#8c8c8c' }}>Ждет вашего согласования</Text>
}

type ViewMode = 'table' | 'cards'
type ItemSize = 'xsmall' | 'small' | 'medium' | 'large' | 'xlarge'

interface FileViewToggleProps {
	files: FileItem[]
	onFileClick?: (file: FileItem) => void
	onFileDoubleClick?: (file: FileItem) => void
	actions?: (file: FileItem) => React.ReactNode
	search?: string
	onSearch?: (v: string) => void
	onCreate?: () => void
	onImport?: () => void
	/** Карточки согласования: версия, статус, чекбокс «согласован» */
	mode?: 'default' | 'approval'
}

const FileIcon: React.FC<{ type: FileItem['type']; size: number }> = ({
	type,
	size,
}) => {
	const icons: Record<FileItem['type'], React.ComponentType<any>> = {
		folder: FolderOutlined,
		doc: FileWordOutlined,
		pdf: FilePdfOutlined,
		image: FileImageOutlined,
		xlsx: FileExcelOutlined,
		txt: FileTextOutlined,
		ppt: FilePptOutlined,
		zip: FileZipOutlined,
		other: FileUnknownOutlined,
	}
	const Icon = icons[type] || FileOutlined
	const color =
		type === 'folder'
			? '#faad14'
			: type === 'pdf'
				? '#ff4d4f'
				: type === 'xlsx'
					? '#52c41a'
					: '#1890ff'
	return <Icon style={{ fontSize: size, color }} />
}

const formatSize = (bytes?: number | string) => {
	if (bytes === undefined || bytes === null) return ''
	if (typeof bytes === 'string') {
		const trimmed = bytes.trim()
		if (trimmed.length === 0) return ''
		return trimmed
	}
	let num = Number(bytes)
	if (Number.isNaN(num)) return ''
	const units = ['B', 'KB', 'MB', 'GB']
	let i = 0
	while (num >= 1024 && i < units.length - 1) {
		num /= 1024
		i++
	}
	return `${num.toFixed(1)} ${units[i]}`
}

export const FileViewToggle: React.FC<FileViewToggleProps> = ({
	files,
	onFileClick,
	onFileDoubleClick,
	actions,
	search: propsSearch,
	onSearch,
	onCreate,
	onImport,
	mode = 'default',
}) => {
	const [viewMode, setViewMode] = useState<ViewMode>('cards')
	const [itemSize, setItemSize] = useState(2)
	/** Вкладка «На согласовании»: по умолчанию только процесс в работе (review), галочка — также утверждённые/отклонённые */
	const [showAllApprovalStatuses, setShowAllApprovalStatuses] = useState(false)
	const sizes: ItemSize[] = ['xsmall', 'small', 'medium', 'large', 'xlarge']
	const size = sizes[itemSize]

	const config = {
		xsmall: {
			cols: 'repeat(auto-fill,minmax(120px,1fr))',
			h: 120,
			icon: 32,
			fs: 11,
		},
		small: {
			cols: 'repeat(auto-fill,minmax(150px,1fr))',
			h: 160,
			icon: 40,
			fs: 12,
		},
		medium: {
			cols: 'repeat(auto-fill,minmax(200px,1fr))',
			h: 200,
			icon: 56,
			fs: 14,
		},
		large: {
			cols: 'repeat(auto-fill,minmax(280px,1fr))',
			h: 260,
			icon: 72,
			fs: 16,
		},
		xlarge: {
			cols: 'repeat(auto-fill,minmax(360px,1fr))',
			h: 340,
			icon: 96,
			fs: 18,
		},
	}[size]

	const isApprovalTerminal = (file: FileItem) =>
		file.status === 'approved' || file.status === 'refusal'

	const displayFiles =
		mode === 'approval' && !showAllApprovalStatuses
			? files.filter(f => f.status === 'review')
			: files

	const renderCards = () => {
		if (mode === 'approval') {
			return (
				<div
					key={`g-approval-${size}`}
					style={{
						display: 'grid',
						gridTemplateColumns: config.cols,
						gap: 16,
						padding: 16,
						animation: 'fadeIn .3s',
					}}
				>
					{displayFiles.map((file, index) => {
						const terminal = isApprovalTerminal(file)
						return (
							<Card
								key={approvalRowKey(file, index)}
								hoverable
								onClick={() => onFileClick?.(file)}
								onDoubleClick={() => onFileDoubleClick?.(file)}
								style={{
									position: 'relative',
									height: config.h,
									display: 'flex',
									flexDirection: 'column',
									cursor: 'pointer',
									background: terminal ? '#f0f0f0' : undefined,
									opacity: terminal ? 0.92 : 1,
								}}
								bodyStyle={{
									padding: '12px',
									display: 'flex',
									flexDirection: 'column',
									alignItems: 'center',
									flex: 1,
								}}
							>
								<div
									style={{
										padding: 12,
										backgroundColor: `${getTypeColor(file.type)}15`,
										borderRadius: 12,
										marginBottom: 8,
									}}
								>
									<FileIcon type={file.type} size={config.icon} />
								</div>
								<Tooltip title={file.name}>
									<Text
										ellipsis
										style={{
											fontSize: config.fs,
											fontWeight: 500,
											textAlign: 'center',
											width: '100%',
										}}
									>
										{file.name}
									</Text>
								</Tooltip>
								<Text type='secondary' style={{ fontSize: 12, marginTop: 4 }}>
									Версия {file.version ?? '—'}
								</Text>
								<div style={{ marginTop: 8 }}>
									<StatusTag status={file.status} />
								</div>
								{!terminal && (
									<div
										style={{ marginTop: 'auto', paddingTop: 12 }}
										onClick={e => e.stopPropagation()}
										onDoubleClick={e => e.stopPropagation()}
									>
										<ApproverDecisionText approved={file.approverApproved} />
									</div>
								)}
								{actions && (
									<div style={{ position: 'absolute', top: 8, right: 8 }}>
										{actions(file)}
									</div>
								)}
							</Card>
						)
					})}
				</div>
			)
		}
		return (
			<div
				key={`g-${size}`}
				style={{
					display: 'grid',
					gridTemplateColumns: config.cols,
					gap: 16,
					padding: 16,
					animation: 'fadeIn .3s',
				}}
			>
				{displayFiles.map(file => (
					<Card
						key={file.id}
						hoverable
						onClick={() => onFileClick?.(file)}
						onDoubleClick={() => onFileDoubleClick?.(file)}
						style={{
							position: 'relative',
							height: config.h,
							display: 'flex',
							flexDirection: 'column',
							cursor: 'pointer',
						}}
						bodyStyle={{
							padding: '12px',
							display: 'flex',
							flexDirection: 'column',
							alignItems: 'center',
							flex: 1,
						}}
					>
						<div
							style={{
								padding: 12,
								backgroundColor: `${getTypeColor(file.type)}15`,
								borderRadius: 12,
								marginBottom: 8,
							}}
						>
							<FileIcon type={file.type} size={config.icon} />
						</div>
						<Tooltip title={file.name}>
							<Text
								ellipsis
								style={{
									fontSize: config.fs,
									fontWeight: 500,
									textAlign: 'center',
									width: '100%',
								}}
							>
								{file.name}
							</Text>
						</Tooltip>
						{size !== 'small' && (
							<Text type='secondary' style={{ fontSize: 11 }}>
								{formatSize(file.size)}
							</Text>
						)}
						<div style={{ marginTop: 'auto', paddingTop: 8 }}>
							<StatusTag status={file.status} />
						</div>
						{actions && (
							<div style={{ position: 'absolute', top: 8, right: 8 }}>
								{actions(file)}
							</div>
						)}
					</Card>
				))}
			</div>
		)
	}

	const renderTable = () => {
		if (mode === 'approval') {
			return (
				<List
					key={`t-approval-${size}`}
					dataSource={displayFiles}
					renderItem={(file, index) => {
						const terminal = isApprovalTerminal(file)
						return (
							<List.Item
								key={approvalRowKey(file, index)}
								onClick={() => onFileClick?.(file)}
								onDoubleClick={() => onFileDoubleClick?.(file)}
								style={{
									padding: '12px 16px',
									cursor: 'pointer',
									background: terminal ? '#f0f0f0' : undefined,
									opacity: terminal ? 0.92 : 1,
								}}
								onMouseEnter={e => {
									if (!terminal)
										e.currentTarget.style.backgroundColor = '#e6f7ff'
								}}
								onMouseLeave={e => {
									e.currentTarget.style.backgroundColor = terminal
										? '#f0f0f0'
										: 'transparent'
								}}
							>
								<List.Item.Meta
									avatar={
										<div
											style={{
												width: 40,
												height: 40,
												display: 'flex',
												alignItems: 'center',
												justifyContent: 'center',
												backgroundColor: `${getTypeColor(file.type)}15`,
												borderRadius: 8,
											}}
										>
											<FileIcon type={file.type} size={24} />
										</div>
									}
									title={<Text strong>{file.name}</Text>}
									description={
										<Space size='small'>
											<Text type='secondary'>
												Версия {file.version ?? '—'}
											</Text>
										</Space>
									}
								/>
								<Space style={{ marginLeft: 'auto' }}>
									<StatusTag status={file.status} />
									{!terminal && (
										<span
											onClick={e => e.stopPropagation()}
											onDoubleClick={e => e.stopPropagation()}
										>
											<ApproverDecisionText approved={file.approverApproved} />
										</span>
									)}
									{actions && actions(file)}
								</Space>
							</List.Item>
						)
					}}
				/>
			)
		}
		return (
			<List
				key={`t-${size}`}
				dataSource={displayFiles}
				renderItem={file => (
					<List.Item
						onClick={() => onFileClick?.(file)}
						onDoubleClick={() => onFileDoubleClick?.(file)}
						style={{ padding: '12px 16px', cursor: 'pointer' }}
						onMouseEnter={e =>
							(e.currentTarget.style.backgroundColor = '#e6f7ff')
						}
						onMouseLeave={e =>
							(e.currentTarget.style.backgroundColor = 'transparent')
						}
					>
						<List.Item.Meta
							avatar={
								<div
									style={{
										width: 40,
										height: 40,
										display: 'flex',
										alignItems: 'center',
										justifyContent: 'center',
										backgroundColor: `${getTypeColor(file.type)}15`,
										borderRadius: 8,
									}}
								>
									<FileIcon type={file.type} size={24} />
								</div>
							}
							title={<Text strong>{file.name}</Text>}
							description={
								<Space size='small'>
									<Text type='secondary'>{file.type.toUpperCase()}</Text>
									<Text type='secondary'>•</Text>
									<Text type='secondary'>{formatSize(file.size)}</Text>
								</Space>
							}
						/>
						<Space style={{ marginLeft: 'auto' }}>
							<Text type='secondary'>
								{(() => {
									const d = new Date(file.updatedAt)
									return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('ru-RU')
								})()}
							</Text>
							<StatusTag status={file.status} />
							{actions && actions(file)}
						</Space>
					</List.Item>
				)}
			/>
		)
	}

	return (
		<div
			style={{
				background: '#fff',
				borderRadius: 8,
				border: '1px solid #e8e8e8',
				WebkitUserSelect: 'none',
				MozUserSelect: 'none',
				msUserSelect: 'none',
				userSelect: 'none',
			}}
		>
			<div
				style={{
					display: 'flex',
					gap: 16,
					padding: '12px 16px',
					background: '#fafafa',
					borderBottom: '1px solid #e8e8e8',
					flexWrap: 'wrap',
					alignItems: 'center',
				}}
			>
				<Segmented
					options={[
						{ label: 'Таблица', value: 'table' },
						{ label: 'Карточки', value: 'cards' },
					]}
					value={viewMode}
					onChange={v => setViewMode(v as ViewMode)}
					size='small'
				/>
				{mode === 'approval' && (
					<Checkbox
						checked={showAllApprovalStatuses}
						onChange={e => setShowAllApprovalStatuses(e.target.checked)}
					>
						Показывать утверждённые и отклонённые
					</Checkbox>
				)}
				<Space align='center' style={{ marginLeft: 'auto' }}>
					<Input
						placeholder='Поиск файлов...'
						prefix={<SearchOutlined />}
						value={propsSearch}
						onChange={e => onSearch?.(e.target.value)}
						allowClear
						style={{ width: 240 }}
					/>
					<Segmented
						options={[
							{ label: 'S', value: 0 },
							{ label: 'M', value: 1 },
							{ label: 'L', value: 2 },
						]}
						value={itemSize}
						onChange={v => setItemSize(Number(v))}
						size='small'
					/>
					{onCreate && (
						<Button type='primary' icon={<PlusOutlined />} onClick={onCreate}>
							Создать
						</Button>
					)}
					{onImport && (
						<Button icon={<UploadOutlined />} onClick={onImport}>
							Импортировать
						</Button>
					)}
				</Space>
			</div>
			<div style={{ maxHeight: '75vh', overflowY: 'auto' }}>
				<div style={{ minHeight: 300 }}>
					{displayFiles.length === 0 ? (
						<EmptyState />
					) : viewMode === 'cards' ? (
						renderCards()
					) : (
						renderTable()
					)}
				</div>
			</div>

			<div
				style={{ padding: '12px 16px', textAlign: 'right', color: '#6b7280' }}
			>
				Файлов: {displayFiles.length}
			</div>
			<style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>
		</div>
	)
}

const getTypeColor = (t: FileItem['type']) =>
	({
		folder: '#faad14',
		pdf: '#ff4d4f',
		xlsx: '#52c41a',
		image: '#52c41a',
		doc: '#1890ff',
		txt: '#8c8c8c',
		ppt: '#eb2f96',
		zip: '#722ed1',
		other: '#1890ff',
	})[t] || '#1890ff'

const StatusTag: React.FC<{ status?: string }> = ({ status }) => {
	if (!status) return null
	const map: Record<string, { c: string; t: string }> = {
		draft: { c: 'warning', t: 'Черновик' },
		approved: { c: 'success', t: 'Утверждён' },
		review: { c: 'processing', t: 'На согласовании' },
		refusal: { c: 'error', t: 'Отклонён' },
		archived: { c: 'default', t: 'Архив' },
	}
	const s = map[status] || { c: 'default', t: status }
	return <Tag color={s.c}>{s.t}</Tag>
}

const EmptyState = () => (
	<div style={{ textAlign: 'center', padding: 60, color: '#8c8c8c' }}>
		<FolderOutlined
			style={{ fontSize: 48, marginBottom: 16, color: '#d9d9d9' }}
		/>
		<div>Нет файлов</div>
	</div>
)
