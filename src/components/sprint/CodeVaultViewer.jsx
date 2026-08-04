import React, { useState, useEffect, useRef } from 'react';
import JSZip from 'jszip';
import { 
    Folder, 
    FileCode, 
    FileText, 
    ChevronRight, 
    ChevronDown, 
    X, 
    Download, 
    Copy, 
    Check, 
    Maximize2, 
    Minimize2,
    Search,
    ExternalLink,
    Code,
    Sparkles,
    ZoomIn,
    ZoomOut,
    RotateCcw,
    Presentation,
    Image as ImageIcon,
    FileSpreadsheet,
    File
} from 'lucide-react';
import { Modal, Button, Badge } from '../common';

// File extension to icon / color helper
const getFileMeta = (filename = '') => {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    switch (ext) {
        case 'js':
        case 'jsx':
        case 'ts':
        case 'tsx':
            return { icon: FileCode, color: '#f7df1e', label: 'JavaScript' };
        case 'html':
        case 'htm':
            return { icon: FileCode, color: '#e34f26', label: 'HTML' };
        case 'css':
        case 'scss':
            return { icon: FileCode, color: '#1572b6', label: 'CSS' };
        case 'py':
            return { icon: FileCode, color: '#3776ab', label: 'Python' };
        case 'json':
            return { icon: FileCode, color: '#cbd5e1', label: 'JSON' };
        case 'md':
            return { icon: FileText, color: '#38bdf8', label: 'Markdown' };
        case 'cpp':
        case 'c':
        case 'h':
            return { icon: FileCode, color: '#00599c', label: 'C/C++' };
        case 'java':
            return { icon: FileCode, color: '#b07219', label: 'Java' };
        case 'pptx':
        case 'ppt':
            return { icon: Presentation, color: '#f97316', label: 'PowerPoint' };
        case 'png':
        case 'jpg':
        case 'jpeg':
        case 'gif':
        case 'svg':
        case 'webp':
            return { icon: ImageIcon, color: '#38bdf8', label: 'Image' };
        case 'pdf':
            return { icon: FileText, color: '#ef4444', label: 'PDF Document' };
        default:
            return { icon: FileText, color: 'var(--text-muted)', label: ext.toUpperCase() || 'FILE' };
    }
};

// Simple Tree Node Component
const TreeNode = ({ node, selectedPath, onSelectFile, level = 0 }) => {
    const [isOpen, setIsOpen] = useState(level === 0 || level === 1);
    const isSelected = selectedPath === node.path;
    const meta = !node.isFolder ? getFileMeta(node.name) : null;
    const IconComp = node.isFolder ? Folder : (meta ? meta.icon : FileText);

    if (node.isFolder) {
        return (
            <div>
                <div
                    onClick={() => setIsOpen(!isOpen)}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px 8px',
                        paddingLeft: `${level * 14 + 8}px`,
                        borderRadius: 'var(--radius-sm)',
                        cursor: 'pointer',
                        userSelect: 'none',
                        color: 'var(--text)',
                        fontSize: '13px',
                        fontWeight: 600,
                        transition: 'background 0.15s ease'
                    }}
                    className="hover:bg-[rgba(255,255,255,0.06)]"
                >
                    {isOpen ? <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} /> : <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />}
                    <IconComp size={15} style={{ color: '#f59e0b' }} />
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{node.name}</span>
                </div>
                {isOpen && node.children && (
                    <div>
                        {node.children.map(child => (
                            <TreeNode
                                key={child.path}
                                node={child}
                                selectedPath={selectedPath}
                                onSelectFile={onSelectFile}
                                level={level + 1}
                            />
                        ))}
                    </div>
                )}
            </div>
        );
    }

    return (
        <div
            onClick={() => onSelectFile(node)}
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 8px',
                paddingLeft: `${level * 14 + 22}px`,
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                userSelect: 'none',
                background: isSelected ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                borderLeft: isSelected ? '3px solid #3b82f6' : '3px solid transparent',
                color: isSelected ? '#ffffff' : 'var(--text)',
                fontSize: '13px',
                transition: 'all 0.15s ease'
            }}
            className="hover:bg-[rgba(255,255,255,0.06)]"
        >
            <IconComp size={14} style={{ color: meta?.color || 'var(--primary-400)' }} />
            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>{node.name}</span>
        </div>
    );
};

export const CodeVaultViewer = ({ isOpen, onClose, doc }) => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [fileTree, setFileTree] = useState([]);
    const [selectedFile, setSelectedFile] = useState(null);
    const [fileContent, setFileContent] = useState('');
    const [fileMode, setFileMode] = useState('text'); // 'text', 'pptx', 'image', 'pdf', 'binary'
    const [pptxSlides, setPptxSlides] = useState([]);
    const [mediaBlobUrl, setMediaBlobUrl] = useState(null);
    const [contentLoading, setContentLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [copied, setCopied] = useState(false);
    const [isFullScreen, setIsFullScreen] = useState(false);
    const [fontSize, setFontSize] = useState(13);
    const containerRef = useRef(null);

    const toggleFullScreen = () => {
        if (!isFullScreen) {
            setIsFullScreen(true);
            if (containerRef.current && containerRef.current.requestFullscreen) {
                containerRef.current.requestFullscreen().catch(() => {});
            }
        } else {
            setIsFullScreen(false);
            if (document.fullscreenElement && document.exitFullscreen) {
                document.exitFullscreen().catch(() => {});
            }
        }
    };

    useEffect(() => {
        if (!isOpen || !doc) return;

        const loadZipOrFile = async () => {
            setLoading(true);
            setError(null);
            setFileTree([]);
            setSelectedFile(null);
            setFileContent('');
            setPptxSlides([]);

            try {
                const url = doc.file_url;
                if (!url) {
                    setError('No file URL provided for this document.');
                    setLoading(false);
                    return;
                }

                const isZip = url.toLowerCase().includes('.zip') || doc.file_type === 'zip';

                if (isZip) {
                    const response = await fetch(url);
                    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                    const arrayBuffer = await response.arrayBuffer();
                    const zip = await JSZip.loadAsync(arrayBuffer);

                    const rootNodes = {};
                    const entries = Object.keys(zip.files);

                    for (const filename of entries) {
                        const zipObj = zip.files[filename];
                        const parts = filename.split('/').filter(Boolean);
                        if (parts.length === 0) continue;

                        let currentPath = '';
                        let parentChildren = rootNodes;

                        parts.forEach((part, index) => {
                            const isLast = index === parts.length - 1;
                            currentPath = currentPath ? `${currentPath}/${part}` : part;
                            const isFolder = !isLast || zipObj.dir;

                            if (!parentChildren[part]) {
                                parentChildren[part] = {
                                    name: part,
                                    path: currentPath,
                                    isFolder: isFolder,
                                    zipEntry: !isFolder ? zipObj : null,
                                    childrenMap: isFolder ? {} : null,
                                    children: isFolder ? [] : null
                                };
                            }

                            if (isFolder) {
                                parentChildren = parentChildren[part].childrenMap;
                            }
                        });
                    }

                    const convertMapToArray = (map) => {
                        return Object.values(map).map(node => {
                            if (node.isFolder && node.childrenMap) {
                                const childrenArr = convertMapToArray(node.childrenMap);
                                childrenArr.sort((a, b) => {
                                    if (a.isFolder === b.isFolder) return a.name.localeCompare(b.name);
                                    return a.isFolder ? -1 : 1;
                                });
                                return { ...node, children: childrenArr };
                            }
                            return node;
                        });
                    };

                    const treeArray = convertMapToArray(rootNodes);
                    treeArray.sort((a, b) => {
                        if (a.isFolder === b.isFolder) return a.name.localeCompare(b.name);
                        return a.isFolder ? -1 : 1;
                    });

                    setFileTree(treeArray);

                    const findFirstFile = (nodes) => {
                        for (const n of nodes) {
                            if (!n.isFolder) return n;
                            if (n.children) {
                                const found = findFirstFile(n.children);
                                if (found) return found;
                            }
                        }
                        return null;
                    };

                    const firstFile = findFirstFile(treeArray);
                    if (firstFile) {
                        handleSelectFile(firstFile);
                    }
                } else {
                    const node = {
                        name: doc.title || doc.file_name || 'Sprint Document',
                        path: doc.title || doc.file_name || 'file',
                        isFolder: false,
                        directUrl: url
                    };
                    setFileTree([node]);
                    handleSelectFile(node);
                }
            } catch (err) {
                console.error('[CodeVaultViewer] Error reading file archive:', err);
                setError('Failed to extract code repository: ' + (err.message || 'CORS or Network error'));
            } finally {
                setLoading(false);
            }
        };

        loadZipOrFile();
    }, [isOpen, doc]);

    const handleSelectFile = async (node) => {
        setSelectedFile(node);
        setContentLoading(true);
        setFileContent('');
        setPptxSlides([]);
        if (mediaBlobUrl) {
            URL.revokeObjectURL(mediaBlobUrl);
            setMediaBlobUrl(null);
        }

        const ext = node.name.split('.').pop()?.toLowerCase() || '';

        try {
            if (ext === 'pptx') {
                setFileMode('pptx');
                let arrayBuffer;
                if (node.zipEntry) {
                    arrayBuffer = await node.zipEntry.async('arraybuffer');
                } else if (node.directUrl) {
                    const res = await fetch(node.directUrl);
                    arrayBuffer = await res.arrayBuffer();
                }

                if (arrayBuffer) {
                    const blob = new Blob([arrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' });
                    const blobUrl = URL.createObjectURL(blob);
                    setMediaBlobUrl(blobUrl);

                    try {
                        const pptxZip = await JSZip.loadAsync(arrayBuffer);
                        const slideFiles = Object.keys(pptxZip.files)
                            .filter(f => /^ppt\/slides\/slide\d+\.xml$/i.test(f))
                            .sort((a, b) => {
                                const numA = parseInt(a.match(/slide(\d+)\.xml/i)?.[1] || 0, 10);
                                const numB = parseInt(b.match(/slide(\d+)\.xml/i)?.[1] || 0, 10);
                                return numA - numB;
                            });

                        const extracted = [];
                        for (let i = 0; i < slideFiles.length; i++) {
                            const slideFile = slideFiles[i];
                            const xmlText = await pptxZip.files[slideFile].async('string');
                            
                            let textParts = [];
                            try {
                                const parser = new DOMParser();
                                const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
                                const nodes = xmlDoc.getElementsByTagName('*');
                                for (let j = 0; j < nodes.length; j++) {
                                    const node = nodes[j];
                                    if (node.nodeName === 'a:t' || node.nodeName.endsWith(':t') || node.nodeName === 't') {
                                        const txt = node.textContent?.trim();
                                        if (txt && !txt.startsWith('<') && !txt.startsWith('AutoShape')) {
                                            textParts.push(txt);
                                        }
                                    }
                                }
                            } catch (e) {}

                            if (textParts.length === 0) {
                                const matches = Array.from(xmlText.matchAll(/<a:t[^>]*>([^<]+)<\/a:t>/gi))
                                    .map(m => m[1].replace(/<[^>]+>/g, '').trim())
                                    .filter(Boolean);
                                textParts = matches;
                            }

                            const cleanTextParts = textParts
                                .map(t => t.replace(/<[^>]+>/g, '').trim())
                                .filter(t => t.length > 0 && !t.startsWith('<') && !t.startsWith('AutoShape'));

                            extracted.push({
                                slideNum: i + 1,
                                title: cleanTextParts[0] || `Slide ${i + 1}`,
                                text: cleanTextParts.join(' ')
                            });
                        }
                        setPptxSlides(extracted);
                    } catch (e) {
                        console.warn('PPTX slide text extraction warning:', e);
                    }
                }
            } else if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext)) {
                setFileMode('image');
                let blob;
                if (node.zipEntry) {
                    blob = await node.zipEntry.async('blob');
                } else if (node.directUrl) {
                    const res = await fetch(node.directUrl);
                    blob = await res.blob();
                }
                if (blob) {
                    setMediaBlobUrl(URL.createObjectURL(blob));
                }
            } else if (ext === 'pdf') {
                setFileMode('pdf');
                let blob;
                if (node.zipEntry) {
                    blob = await node.zipEntry.async('blob');
                } else if (node.directUrl) {
                    const res = await fetch(node.directUrl);
                    blob = await res.blob();
                }
                if (blob) {
                    setMediaBlobUrl(URL.createObjectURL(blob));
                }
            } else if (ext === 'ppt') {
                setFileMode('binary');
                let blob;
                if (node.zipEntry) {
                    blob = await node.zipEntry.async('blob');
                } else if (node.directUrl) {
                    const res = await fetch(node.directUrl);
                    blob = await res.blob();
                }
                if (blob) {
                    setMediaBlobUrl(URL.createObjectURL(blob));
                }
            } else {
                setFileMode('text');
                if (node.zipEntry) {
                    const text = await node.zipEntry.async('string');
                    setFileContent(text);
                } else if (node.directUrl) {
                    const res = await fetch(node.directUrl);
                    const text = await res.text();
                    setFileContent(text);
                }
            }
        } catch (err) {
            setFileMode('text');
            setFileContent(`// Error loading content for ${node.name}: ${err.message}`);
        } finally {
            setContentLoading(false);
        }
    };

    const handleCopy = () => {
        if (fileMode === 'pptx' && pptxSlides.length > 0) {
            const fullText = pptxSlides.map(s => `--- SLIDE ${s.slideNum} ---\n${s.text}`).join('\n\n');
            navigator.clipboard.writeText(fullText);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
            return;
        }
        if (!fileContent) return;
        navigator.clipboard.writeText(fileContent);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (!isOpen || !doc) return null;

    const filterTree = (nodes, query) => {
        if (!query.trim()) return nodes;
        const q = query.toLowerCase();

        return nodes.reduce((acc, node) => {
            if (node.isFolder) {
                const filteredChildren = filterTree(node.children || [], query);
                if (filteredChildren.length > 0 || node.name.toLowerCase().includes(q)) {
                    acc.push({ ...node, children: filteredChildren });
                }
            } else if (node.name.toLowerCase().includes(q)) {
                acc.push(node);
            }
            return acc;
        }, []);
    };

    const displayedTree = filterTree(fileTree, searchQuery);
    const lineCount = fileContent ? fileContent.split('\n').length : 0;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Code size={20} style={{ color: '#38bdf8' }} />
                    <span>{doc.title || 'Sprint Code Vault Explorer'}</span>
                    <Badge variant="primary" style={{ fontSize: '10px' }}>
                        Week {doc.week_number || '?'}
                    </Badge>
                </div>
            }
            size="xl"
        >
            <div 
                ref={containerRef}
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    ...(isFullScreen ? {
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        width: '100vw',
                        height: '100vh',
                        zIndex: 999999,
                        borderRadius: 0,
                        border: 'none'
                    } : {
                        height: '580px',
                        borderRadius: 'var(--radius-lg)',
                        border: '1px solid var(--border)'
                    }),
                    background: '#0f172a',
                    overflow: 'hidden'
                }}
            >
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 14px',
                    background: '#1e293b',
                    borderBottom: '1px solid #334155',
                    color: '#94a3b8',
                    fontSize: '12px'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Sparkles size={14} style={{ color: '#f59e0b' }} />
                            Vault Explorer
                        </span>
                        {selectedFile && (
                            <span style={{ color: '#38bdf8', fontFamily: 'monospace', fontSize: '11px' }}>
                                📄 {selectedFile.path}
                            </span>
                        )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {fileMode === 'text' && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '3px', background: '#0f172a', padding: '3px 7px', borderRadius: '6px', border: '1px solid #334155' }}>
                                <button
                                    onClick={() => setFontSize(s => Math.min(s + 2, 26))}
                                    style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}
                                    title="Zoom In (Increase Font Size)"
                                    className="hover:text-white"
                                >
                                    <ZoomIn size={14} />
                                </button>
                                <span style={{ fontSize: '11px', color: '#cbd5e1', fontWeight: 600, minWidth: '32px', textAlign: 'center', fontFamily: 'monospace' }}>
                                    {fontSize}px
                                </span>
                                <button
                                    onClick={() => setFontSize(s => Math.max(s - 2, 9))}
                                    style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}
                                    title="Zoom Out (Decrease Font Size)"
                                    className="hover:text-white"
                                >
                                    <ZoomOut size={14} />
                                </button>
                                <button
                                    onClick={() => setFontSize(13)}
                                    style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center', marginLeft: '2px' }}
                                    title="Reset Font Size to 13px"
                                    className="hover:text-white"
                                >
                                    <RotateCcw size={12} />
                                </button>
                            </div>
                        )}

                        {selectedFile && (fileContent || pptxSlides.length > 0) && (
                            <button
                                onClick={handleCopy}
                                style={{
                                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                                    padding: '4px 10px', borderRadius: '6px',
                                    background: 'rgba(255,255,255,0.1)', border: 'none',
                                    color: '#f8fafc', cursor: 'pointer', fontSize: '11px', fontWeight: 600
                                }}
                            >
                                {copied ? <><Check size={12} style={{ color: '#4ade80' }} /> Copied!</> : <><Copy size={12} /> Copy {fileMode === 'pptx' ? 'Slide Text' : 'Code'}</>}
                            </button>
                        )}

                        {mediaBlobUrl && (
                            <a
                                href={mediaBlobUrl}
                                download={selectedFile?.name || 'file.pptx'}
                                style={{
                                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                                    padding: '4px 10px', borderRadius: '6px',
                                    background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)', border: 'none',
                                    color: 'white', textDecoration: 'none', fontSize: '11px', fontWeight: 700
                                }}
                            >
                                <Download size={12} /> Download File
                            </a>
                        )}

                        <button
                            onClick={toggleFullScreen}
                            style={{
                                display: 'inline-flex', alignItems: 'center', gap: '4px',
                                padding: '4px 10px', borderRadius: '6px',
                                background: 'rgba(255,255,255,0.1)', border: 'none',
                                color: '#f8fafc', cursor: 'pointer', fontSize: '11px', fontWeight: 600
                            }}
                            title="Toggle Fullscreen"
                        >
                            {isFullScreen ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
                        </button>
                    </div>
                </div>

                <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
                    <div style={{
                        width: '240px',
                        background: '#0f172a',
                        borderRight: '1px solid #334155',
                        display: 'flex',
                        flexDirection: 'column',
                        flexShrink: 0
                    }}>
                        <div style={{ padding: '8px', borderBottom: '1px solid #1e293b' }}>
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: '6px',
                                background: '#1e293b', padding: '4px 8px', borderRadius: '6px',
                                border: '1px solid #334155'
                            }}>
                                <Search size={13} style={{ color: '#64748b' }} />
                                <input
                                    type="text"
                                    placeholder="Search files..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    style={{
                                        background: 'none', border: 'none', outline: 'none',
                                        color: '#f8fafc', fontSize: '12px', width: '100%'
                                    }}
                                />
                            </div>
                        </div>

                        <div style={{ flex: 1, overflowY: 'auto', padding: '6px 4px' }}>
                            {loading ? (
                                <div style={{ padding: '20px', textAlign: 'center', color: '#64748b', fontSize: '12px' }}>
                                    Extracting repository tree...
                                </div>
                            ) : error ? (
                                <div style={{ padding: '14px', color: '#f87171', fontSize: '12px' }}>
                                    {error}
                                </div>
                            ) : displayedTree.length === 0 ? (
                                <div style={{ padding: '20px', textAlign: 'center', color: '#64748b', fontSize: '12px' }}>
                                    No files found
                                </div>
                            ) : (
                                displayedTree.map(node => (
                                    <TreeNode
                                        key={node.path}
                                        node={node}
                                        selectedPath={selectedFile?.path}
                                        onSelectFile={handleSelectFile}
                                    />
                                ))
                            )}
                        </div>
                    </div>

                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#090d16', overflow: 'hidden' }}>
                        {selectedFile ? (
                            <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'auto', position: 'relative' }}>
                                {contentLoading ? (
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', color: '#64748b', fontSize: '13px' }}>
                                        Reading presentation & file contents...
                                    </div>
                                ) : fileMode === 'pptx' ? (
                                    <div style={{ flex: 1, padding: '20px', overflowY: 'auto', color: '#e2e8f0' }}>
                                        <div style={{
                                            background: 'linear-gradient(135deg, rgba(249,115,22,0.15) 0%, rgba(234,88,12,0.05) 100%)',
                                            border: '1px solid rgba(249,115,22,0.3)',
                                            borderRadius: '12px',
                                            padding: '16px 20px',
                                            marginBottom: '20px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between'
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                                <div style={{
                                                    width: '44px', height: '44px', borderRadius: '10px',
                                                    background: '#f97316', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    color: 'white', boxShadow: '0 4px 12px rgba(249,115,22,0.4)'
                                                }}>
                                                    <Presentation size={24} />
                                                </div>
                                                <div>
                                                    <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#ffffff' }}>
                                                        {selectedFile.name}
                                                    </h4>
                                                    <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#fdba74' }}>
                                                        PowerPoint Presentation • {pptxSlides.length > 0 ? `${pptxSlides.length} Extracted Slides` : 'Ready to View & Download'}
                                                    </p>
                                                </div>
                                            </div>

                                            {mediaBlobUrl && (
                                                <a
                                                    href={mediaBlobUrl}
                                                    download={selectedFile.name}
                                                    style={{
                                                        display: 'inline-flex', alignItems: 'center', gap: '6px',
                                                        padding: '10px 18px', borderRadius: '10px',
                                                        background: '#f97316', color: 'white', fontWeight: 700,
                                                        fontSize: '13px', textDecoration: 'none',
                                                        boxShadow: '0 4px 15px rgba(249,115,22,0.3)'
                                                    }}
                                                    className="hover:opacity-90 active:scale-95"
                                                >
                                                    <Download size={16} /> Download PPTX File
                                                </a>
                                            )}
                                        </div>

                                        {pptxSlides.length > 0 ? (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                                <h5 style={{ margin: '0 0 4px 0', fontSize: '13px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                                    📊 Presentation Slide Outline
                                                </h5>
                                                {pptxSlides.map(s => (
                                                    <div key={s.slideNum} style={{
                                                        background: '#0f172a',
                                                        border: '1px solid #1e293b',
                                                        borderRadius: '10px',
                                                        padding: '14px 16px'
                                                    }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                                            <span style={{
                                                                background: '#334155', color: '#38bdf8', padding: '2px 8px',
                                                                borderRadius: '12px', fontSize: '11px', fontWeight: 700
                                                            }}>
                                                                Slide {s.slideNum}
                                                            </span>
                                                        </div>
                                                        <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.6, color: '#cbd5e1' }}>
                                                            {s.text || <i style={{ color: '#64748b' }}>No text content found on this slide (Images/Shapes).</i>}
                                                        </p>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8' }}>
                                                <Presentation size={48} style={{ opacity: 0.4, marginBottom: '12px' }} />
                                                <p style={{ margin: 0, fontSize: '14px' }}>This PowerPoint presentation can be downloaded directly using the button above.</p>
                                            </div>
                                        )}
                                    </div>
                                ) : fileMode === 'image' && mediaBlobUrl ? (
                                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', background: '#090d16' }}>
                                        <img
                                            src={mediaBlobUrl}
                                            alt={selectedFile.name}
                                            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: '8px', boxShadow: '0 8px 30px rgba(0,0,0,0.5)' }}
                                        />
                                    </div>
                                ) : fileMode === 'pdf' && mediaBlobUrl ? (
                                    <iframe
                                        src={mediaBlobUrl}
                                        title={selectedFile.name}
                                        style={{ width: '100%', height: '100%', border: 'none' }}
                                    />
                                ) : (
                                    <div style={{ display: 'flex', width: '100%', fontFamily: 'Consolas, Monaco, "Fira Code", monospace', fontSize: `${fontSize}px`, lineHeight: 1.6 }}>
                                        <div style={{
                                            padding: '12px 8px',
                                            background: '#0b0f19',
                                            borderRight: '1px solid #1e293b',
                                            color: '#475569',
                                            textAlign: 'right',
                                            userSelect: 'none',
                                            minWidth: '40px'
                                        }}>
                                            {Array.from({ length: lineCount }).map((_, i) => (
                                                <div key={i + 1}>{i + 1}</div>
                                            ))}
                                        </div>
                                        <pre style={{
                                            flex: 1,
                                            margin: 0,
                                            padding: '12px 16px',
                                            color: '#e2e8f0',
                                            overflowX: 'auto',
                                            whiteSpace: 'pre',
                                            fontFamily: 'inherit'
                                        }}>
                                            <code>{fileContent}</code>
                                        </pre>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#64748b' }}>
                                <FileCode size={48} style={{ opacity: 0.3, marginBottom: '12px' }} />
                                <p style={{ margin: 0, fontSize: '13px' }}>Select a file or presentation from the repository tree on the left to view.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default CodeVaultViewer;
