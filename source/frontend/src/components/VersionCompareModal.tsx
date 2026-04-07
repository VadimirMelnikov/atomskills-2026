import React, { useEffect, useRef, useState } from 'react'
import { Modal, Spin, message } from 'antd'

interface CompareConfigResponse {
    config: any
    compareFileUrl: string
}

interface VersionCompareModalProps {
    open: boolean
    docId: number
    baseVersionId: number | null
    editorKey?: string | null
    onClose: () => void
}

const VersionCompareModal: React.FC<VersionCompareModalProps> = ({
    open, docId, baseVersionId, editorKey, onClose,
}) => {
    const editorRef = useRef<OOEditorInstance | null>(null)
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (!open || baseVersionId == null || !window.DocsAPI) return

        let cancelled = false
        setLoading(true)

        const init = async () => {
            try {
                const res = await fetch(
                    `/api/document/${docId}/compare-config?base_version_id=${baseVersionId}${editorKey ? `&editor_key=${encodeURIComponent(editorKey)}` : ''}`,
                    { credentials: 'include' },
                )
                if (!res.ok) throw new Error('Ошибка загрузки конфигурации сравнения')
                const { config, compareFileUrl }: CompareConfigResponse = await res.json()
                if (cancelled) return

                await new Promise(r => setTimeout(r, 300))
                if (cancelled) return

                const editorConfig = {
                    ...config,
                    width: '100%',
                    height: '100%',
                    events: {
                        onRequestCompareFile: () => {
                            // Required subscription for setRevisedFile to work
                        },
                        onDocumentReady: () => {
                            setTimeout(() => {
                                if (editorRef.current?.setRevisedFile) {
                                    editorRef.current.setRevisedFile({
                                        fileType: 'docx',
                                        url: compareFileUrl,
                                    })
                                } else {
                                    message.warning('Метод сравнения недоступен')
                                }
                            }, 2000)
                        },
                    },
                }

                editorRef.current?.destroyEditor?.()
                editorRef.current = new window.DocsAPI!.DocEditor('compare-editor', editorConfig)
                if (!cancelled) setLoading(false)
            } catch (err) {
                if (!cancelled) {
                    setLoading(false)
                    message.error((err as Error).message || 'Ошибка инициализации сравнения')
                }
            }
        }

        init()

        return () => {
            cancelled = true
            editorRef.current?.destroyEditor?.()
            editorRef.current = null
        }
    }, [open, docId, baseVersionId, editorKey])

    return (
        <Modal
            open={open}
            onCancel={onClose}
            title="Сравнение версий"
            width="95vw"
            style={{ top: 20 }}
            styles={{ body: { height: 'calc(90vh - 55px)', padding: 0, overflow: 'hidden' } }}
            footer={null}
            destroyOnClose
        >
            <div style={{ width: '100%', height: '100%', position: 'relative' }}>
                {loading && (
                    <div style={{
                        position: 'absolute', inset: 0, display: 'flex',
                        justifyContent: 'center', alignItems: 'center',
                        zIndex: 10, background: 'rgba(255,255,255,0.8)',
                    }}>
                        <Spin size="large" />
                    </div>
                )}
                <div id="compare-editor" style={{ width: '100%', height: '100%' }} />
            </div>
        </Modal>
    )
}

export default VersionCompareModal
