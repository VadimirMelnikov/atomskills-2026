import React, { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Typography, message, Spin, Button } from 'antd'
import { SaveOutlined, ShareAltOutlined, TeamOutlined, SendOutlined, HistoryOutlined, RightOutlined, DownOutlined } from '@ant-design/icons'
import ShareDocumentModal from '../components/ShareDocumentModal/ShareDocumentModal'
import VersionCompareModal from '../components/VersionCompareModal'
import DocumentCoauthorsBlock from '../components/DocumentCoauthorsBlock'
import DocumentApproversBlock from '../components/DocumentApproversBlock'
import DocumentVersionHistoryBlock from '../components/DocumentVersionHistoryBlock'
import MoveToApprovalForm from '../components/MoveToApprovalForm'
import {
    useGetDocumentEditorConfigQuery,
    useCreateNewVersionMutation,
    useGetDocumentVersionsQuery,
    type DocumentVersion,
} from '../store/api/documentApi'
import { versionStatusTag } from '../components/documentPanelHelpers'

const { Title, Text, Paragraph } = Typography

// В проде браузер не должен обращаться к localhost:8082.
// nginx проксирует /onlyoffice/* в контейнер OnlyOffice.
const ONLYOFFICE_API_URL = '/onlyoffice/web-apps/apps/api/documents/api.js'
const ONLYOFFICE_LOAD_TIMEOUT_MS = 90_000
const RETRY_INTERVAL_MS = 3_000

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const loadOnlyOfficeApi = async () => {
    if (window.DocsAPI) return

    const startedAt = Date.now()
    while (Date.now() - startedAt < ONLYOFFICE_LOAD_TIMEOUT_MS) {
        try {
            await new Promise<void>((resolve, reject) => {
                const existing = document.querySelector(`script[src="${ONLYOFFICE_API_URL}"]`)
                if (existing) {
                    existing.remove()
                }

                const script = document.createElement('script')
                script.src = `${ONLYOFFICE_API_URL}?t=${Date.now()}`
                script.async = true
                script.onload = () => resolve()
                script.onerror = () => reject(new Error('Не удалось загрузить ONLYOFFICE api.js'))
                document.body.appendChild(script)
            })
            if (window.DocsAPI) return
        } catch {
            await sleep(RETRY_INTERVAL_MS)
        }
    }
    throw new Error('Не удалось загрузить ONLYOFFICE api.js: сервис еще запускается, попробуйте через минуту')
}

type SideSection = 'coauthors' | 'approval' | 'history' | null

const sectionHeaderStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '12px 16px',
    cursor: 'pointer',
    userSelect: 'none',
    fontWeight: 600,
    fontSize: 14,
    borderBottom: '1px solid #f0f0f0',
    background: '#fafafa',
    transition: 'background .15s',
}

const sectionBodyStyle: React.CSSProperties = {
    padding: 16,
    borderBottom: '1px solid #f0f0f0',
}

const Profile: React.FC = () => {
    const [searchParams] = useSearchParams()
    const documentIdParam = searchParams.get('documentId')
    const urlDocumentId =
        documentIdParam != null && documentIdParam !== '' ? parseInt(documentIdParam, 10) : NaN
    const hasUrlDocumentId = Number.isInteger(urlDocumentId) && urlDocumentId > 0
    const versionParam = searchParams.get('version')
    const urlVersion =
        versionParam != null && versionParam !== '' ? parseInt(versionParam, 10) : NaN
    const hasUrlVersion = Number.isInteger(urlVersion) && urlVersion > 0

    const editorRef = useRef<OOEditorInstance | null>(null)
    const editorKeyRef = useRef<string | null>(null)
    const [isSaving, setIsSaving] = useState(false)
    const [shareModalVisible, setShareModalVisible] = useState(false)
    const [compareVersionId, setCompareVersionId] = useState<number | null>(null)
    const [openSection, setOpenSection] = useState<SideSection>('history')
    const [createNewVersion] = useCreateNewVersionMutation()

    const editorDocumentId = hasUrlDocumentId ? urlDocumentId : null
    const editorVersion = hasUrlVersion ? urlVersion : undefined
    const editorConfigArg = editorDocumentId
        ? editorVersion != null
            ? { docId: editorDocumentId, version: editorVersion }
            : editorDocumentId
        : 0

    const { data: config, isLoading: isConfigLoading, error: configError, refetch: refetchEditorConfig } = useGetDocumentEditorConfigQuery(editorConfigArg, {
        skip: !editorDocumentId,
    })

    const isAccessDenied =
        !isConfigLoading && Boolean(configError) && (configError as any)?.status === 403

    const { data: versions = [], isLoading: versionsLoading } = useGetDocumentVersionsQuery(editorDocumentId!, {
        skip: !editorDocumentId,
    })

    const latestVersion: DocumentVersion | null =
        versions.length > 0
            ? versions.reduce(
                  (max: DocumentVersion, v: DocumentVersion) => (v.version > max.version ? v : max),
                  versions[0]
              )
            : null

    const docTitle = (config?.document?.title as string | undefined) ?? 'Документ'

    const isDocumentOwner = Boolean((config as { is_owner?: boolean } | undefined)?.is_owner)
    const showSaveVersionButton =
        isDocumentOwner &&
        !versionsLoading &&
        latestVersion !== null &&
        latestVersion.status === 'refusal'

    const toggleSection = (key: Exclude<SideSection, null>) => {
        setOpenSection((prev: SideSection) => (prev === key ? null : key))
    }

    useEffect(() => {
        let cancelled = false
        const init = async () => {
            if (!editorDocumentId || !config) return

            try {
                await loadOnlyOfficeApi()
                if (cancelled) return

                const editorConfig = {
                    ...config,
                    width: '100%',
                    height: '920px',
                }

                editorKeyRef.current = config?.document?.key || null
                editorRef.current?.destroyEditor?.()
                editorRef.current = new window.DocsAPI!.DocEditor('onlyoffice-editor', editorConfig)
            } catch (err) {
                if (!cancelled) message.error((err as Error).message || 'Ошибка инициализации редактора')
            }
        }

        init()

        return () => {
            cancelled = true
            editorRef.current?.destroyEditor?.()
            editorRef.current = null
        }
    }, [editorDocumentId, config])

    if (isAccessDenied) {
        return (
            <div style={{ padding: '20px 24px' }}>
                <Paragraph type="secondary">Для получения прав обратитесь к владельцу документа</Paragraph>
            </div>
        )
    }

    const handleSave = async () => {
        if (!editorRef.current || !editorDocumentId) {
            message.warning('Редактор не загружен')
            return
        }
        setIsSaving(true)
        const loadingKey = 'onlyoffice-save-status'
        message.loading({
            content: 'Сохранение и создание новой версии...',
            key: loadingKey,
            duration: 0,
        })
        try {
            const forceSaveWithKey = async (editorKey?: string | null) => {
                const keyParam = editorKey
                    ? `?editor_key=${encodeURIComponent(editorKey)}`
                    : ''
                const res = await fetch(`/api/document/${editorDocumentId}/force-save${keyParam}`, {
                    method: 'POST',
                    credentials: 'include',
                })
                if (!res.ok) {
                    const text = await res.text()
                    throw new Error(text || 'Не удалось сохранить документ')
                }
            }

            let activeEditorKey = editorKeyRef.current
            try {
                await forceSaveWithKey(activeEditorKey)
            } catch (error) {
                const detail = (error as Error).message || ''
                const isInvalidOnlyOfficeKey = detail.includes(`'error': 3`) || detail.includes(`"error": 3`)
                if (!isInvalidOnlyOfficeKey) throw error

                const refreshed = await refetchEditorConfig()
                const refreshedKey = (refreshed as { data?: { document?: { key?: string } } })?.data?.document?.key
                activeEditorKey = refreshedKey ?? activeEditorKey
                editorKeyRef.current = activeEditorKey ?? null
                await forceSaveWithKey(activeEditorKey)
            }

            await sleep(3000)
            const createdVersion = await createNewVersion(editorDocumentId).unwrap()

            if (createdVersion?.version != null) {
                // Переинициализируем редактор на созданную версию.
                window.location.href = `/document?documentId=${editorDocumentId}&version=${createdVersion.version}`
            }

            message.success({
                content: 'Новая версия создана',
                key: loadingKey,
            })
        } catch (error) {
            message.error({
                content: 'Ошибка при сохранении: ' + (error as Error).message,
                key: loadingKey,
            })
        } finally {
            setIsSaving(false)
        }
    }

    const handleCompareVersion = (versionId: number) => {
        setCompareVersionId(versionId)
    }

    const isEditorLoading = Boolean(editorDocumentId) && isConfigLoading

    return (
        <div style={{ padding: '20px 24px' }}>
            {!editorDocumentId ? (
                <Paragraph type="secondary" style={{ marginTop: 24 }}>
                    Документ не выбран. Откройте его из раздела <Link to="/files/my">«Мои файлы»</Link>
                </Paragraph>
            ) : (
                <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, gap: 16, flexWrap: 'wrap' }}>
                        <div>
                            <Title level={4} style={{ margin: 0 }}>
                                {docTitle}
                            </Title>
                            <div style={{ marginTop: 6 }}>
                                {versionsLoading ? (
                                    <Spin size="small" />
                                ) : latestVersion ? (
                                    versionStatusTag(latestVersion.status)
                                ) : (
                                    <Text type="secondary">Нет данных о версиях</Text>
                                )}
                            </div>
                        </div>
                        {showSaveVersionButton && (
                            <Button
                                type="primary"
                                onClick={handleSave}
                                loading={isSaving}
                                disabled={isEditorLoading}
                                icon={<SaveOutlined />}
                            >
                                Создать версию
                            </Button>
                        )}
                    </div>

                    <div style={{ display: 'flex', gap: 20 }}>
                        {/* Editor */}
                        <div style={{ flex: '1 1 0%', minWidth: 0 }}>
                            {isEditorLoading ? (
                                <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 120 }}>
                                    <Spin size="large" tip="Загрузка редактора..." />
                                </div>
                            ) : (
                                <div
                                    id="onlyoffice-editor"
                                    style={{
                                        width: '100%',
                                        height: 920,
                                        border: '2px solid #1677ff',
                                        borderRadius: 8,
                                        overflow: 'hidden',
                                    }}
                                />
                            )}
                        </div>

                        {/* Right panel — VS Code style accordion */}
                        <div
                            style={{
                                width: 360,
                                flexShrink: 0,
                                border: '1px solid #d9d9d9',
                                borderRadius: 8,
                                overflow: 'hidden',
                                alignSelf: 'flex-start',
                            }}
                        >
                            {/* --- Соавторы --- */}
                            <div
                                style={sectionHeaderStyle}
                                onClick={() => toggleSection('coauthors')}
                            >
                                {openSection === 'coauthors' ? <DownOutlined style={{ fontSize: 10 }} /> : <RightOutlined style={{ fontSize: 10 }} />}
                                <TeamOutlined />
                                Соавторы
                            </div>
                            {openSection === 'coauthors' && editorDocumentId && (
                                <div style={sectionBodyStyle}>
                                    <DocumentCoauthorsBlock documentId={editorDocumentId} />
                                    <Button
                                        block
                                        icon={<ShareAltOutlined />}
                                        style={{ marginTop: 12 }}
                                        onClick={() => setShareModalVisible(true)}
                                    >
                                        Поделиться доступом
                                    </Button>
                                </div>
                            )}

                            {/* --- Согласование --- */}
                            <div
                                style={sectionHeaderStyle}
                                onClick={() => toggleSection('approval')}
                            >
                                {openSection === 'approval' ? <DownOutlined style={{ fontSize: 10 }} /> : <RightOutlined style={{ fontSize: 10 }} />}
                                <SendOutlined />
                                Согласование
                            </div>
                            {openSection === 'approval' && editorDocumentId && (
                                <div style={sectionBodyStyle}>
                                    <DocumentApproversBlock documentId={editorDocumentId} />
                                    <div style={{ margin: '16px 0 8px', borderTop: '1px solid #f0f0f0', paddingTop: 12 }}>
                                        <Text strong style={{ fontSize: 13 }}>Отправить на согласование</Text>
                                    </div>
                                    <MoveToApprovalForm documentId={editorDocumentId} />
                                </div>
                            )}

                            {/* --- История изменений --- */}
                            <div
                                style={{ ...sectionHeaderStyle, borderBottom: openSection === 'history' ? '1px solid #f0f0f0' : 'none' }}
                                onClick={() => toggleSection('history')}
                            >
                                {openSection === 'history' ? <DownOutlined style={{ fontSize: 10 }} /> : <RightOutlined style={{ fontSize: 10 }} />}
                                <HistoryOutlined />
                                История изменений
                            </div>
                            {openSection === 'history' && editorDocumentId && (
                                <div style={{ ...sectionBodyStyle, borderBottom: 'none' }}>
                                    <DocumentVersionHistoryBlock
                                        documentId={editorDocumentId}
                                        onCompareVersion={handleCompareVersion}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}

            <ShareDocumentModal
                visible={shareModalVisible}
                documentId={editorDocumentId || 0}
                onClose={() => setShareModalVisible(false)}
            />

            {editorDocumentId && (
                <VersionCompareModal
                    open={compareVersionId !== null}
                    docId={editorDocumentId}
                    baseVersionId={compareVersionId}
                    editorKey={editorKeyRef.current}
                    onClose={() => setCompareVersionId(null)}
                />
            )}
        </div>
    )
}

export default Profile
