import React, { useEffect, useRef, useState } from 'react'
import { Spin, message } from 'antd'

interface OfficeEditorProps {
	documentId: number | string
	height?: string | number
	onConfigError?: (error: Error) => void
}

declare global {
	interface OOEditorInstance {
		destroyEditor?: () => void
		setRevisedFile?: (params: { fileType: string; url: string }) => void
	}

	interface Window {
		DocsAPI?: {
			DocEditor: new (id: string, config: any) => OOEditorInstance
		}
	}
}

// В проде браузер не должен обращаться к localhost:8082.
// nginx проксирует /onlyoffice/* в контейнер OnlyOffice.
const ONLYOFFICE_API_URL = '/onlyoffice/web-apps/apps/api/documents/api.js'
const LOAD_TIMEOUT = 90_000
const RETRY_INTERVAL = 3_000

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// Вынесено наружу, чтобы загрузка скрипта была синглтоном
const loadOfficeScript = async () => {
	if (window.DocsAPI) return

	const startedAt = Date.now()
	while (Date.now() - startedAt < LOAD_TIMEOUT) {
		try {
			await new Promise<void>((resolve, reject) => {
				const existing = document.querySelector(`script[src^="${ONLYOFFICE_API_URL}"]`)
				if (existing) existing.remove()

				const script = document.createElement('script')
				script.src = `${ONLYOFFICE_API_URL}?t=${Date.now()}`
				script.async = true
				script.onload = () => resolve()
				script.onerror = () => reject()
				document.body.appendChild(script)
			})
			if (window.DocsAPI) return
		} catch {
			await sleep(RETRY_INTERVAL)
		}
	}
	throw new Error('Не удалось загрузить скрипт редактора (сервис запускается)')
}

const OfficeEditor: React.FC<OfficeEditorProps> = ({ 
	documentId, 
	height = 920, 
	onConfigError 
}) => {
	const [isLoading, setIsLoading] = useState(true)
	const editorRef = useRef<{ destroyEditor?: () => void } | null>(null)
	const containerId = useRef(`office-editor-${Math.random().toString(36).substr(2, 9)}`)

	useEffect(() => {
		let cancelled = false

		const initEditor = async () => {
			try {
				setIsLoading(true)
				await loadOfficeScript()
				
				// Используем правильный эндпоинт из document.api
				const res = await fetch(`/api/document/${documentId}`, { 
					method: 'GET',
					credentials: 'include' 
				})
				
				if (!res.ok) {
					const errorData = await res.json().catch(() => ({}))
					throw new Error(errorData.detail || `Ошибка загрузки конфигурации: ${res.status}`)
				}
				
				const config = await res.json()
				
				if (cancelled) return

				// Настройка размеров редактора
				config.width = '100%'
				config.height = typeof height === 'number' ? `${height}px` : height

				// Очистка старого экземпляра перед созданием нового
				editorRef.current?.destroyEditor?.()
				editorRef.current = new window.DocsAPI!.DocEditor(containerId.current, config)
				
			} catch (err) {
				if (!cancelled) {
					const error = err as Error
					message.error(error.message || 'Ошибка загрузки редактора')
					onConfigError?.(error)
				}
			} finally {
				if (!cancelled) setIsLoading(false)
			}
		}

		initEditor()

		return () => {
			cancelled = true
			editorRef.current?.destroyEditor?.()
			editorRef.current = null
		}
	}, [documentId, height, onConfigError])

	return (
		<div style={{ position: 'relative', width: '100%', minHeight: height }}>
			{isLoading && (
				<div style={{ 
					position: 'absolute', 
					top: '50%', 
					left: '50%', 
					transform: 'translate(-50%, -50%)',
					zIndex: 10 
				}}>
					<Spin size="large" tip="Загрузка редактора..." />
				</div>
			)}
			<div 
				id={containerId.current} 
				style={{ 
					width: '100%', 
					height: height, 
					border: '1px solid #f0f0f0', 
					borderRadius: 8,
					visibility: isLoading ? 'hidden' : 'visible'
				}} 
			/>
		</div>
	)
}

export default OfficeEditor