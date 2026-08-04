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
    RotateCcw
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

            try {
                const url = doc.file_url;
                if (!url) {
                    setError('No file URL provided for this document.');
                    setLoading(false);
                    return;
                }

                // Check if file is a zip archive
                const isZip = url.toLowerCase().includes('.zip') || doc.file_type === 'zip';

                if (isZip) {
                    const response = await fetch(url);
                    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                    const arrayBuffer = await response.arrayBuffer();
                    const zip = await JSZip.loadAsync(arrayBuffer);

                    // Build nested tree structure
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

                    // Convert map tree to array recursive helper
                    const convertMapToArray = (map) => {
                        return Object.values(map).map(node => {
                            if (node.isFolder && node.childrenMap) {
                                const childrenArr = convertMapToArray(node.childrenMap);
                                // Sort folders first, then files
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

                    // Auto-select first non-folder file
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
                    // Direct single file view (e.g. .js, .txt, .md, .py)
                    const node = {
                        name: doc.title || 'Code File',
                        path: doc.title || 'file',
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

        try {
            if (node.zipEntry) {
                const text = await node.zipEntry.async('string');
                setFileContent(text);
            } else if (node.directUrl) {
                const res = await fetch(node.directUrl);
                const text = await res.text();
                setFileContent(text);
            }
        } catch (err) {
            setFileContent(`// Error loading content for ${node.name}: ${err.message}`);
        } finally {
            setContentLoading(false);
        }
    };

    const handleCopy = () => {
        if (!fileContent) return;
        navigator.clipboard.writeText(fileContent);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (!isOpen || !doc) return null;

    // Filter tree helper
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
    const lineCount = fileContent.split('\n').length;

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
                {/* Explorer Top Toolbar */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justify: 'space-between',
                    padding: '8px 14px',
                    background: '#1e293b',
                    borderBottom: '1px solid #334155',
                    color: '#94a3b8',
                    fontSize: '12px'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Sparkles size={14} style={{ color: '#f59e0b' }} />
                            Vault Code Browser
                        </span>
                        {selectedFile && (
                            <span style={{ color: '#38bdf8', fontFamily: 'monospace', fontSize: '11px' }}>
                                📄 {selectedFile.path}
                            </span>
                        )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {/* Zoom / Font Size Controls */}
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

                        {selectedFile && (
                            <button
                                onClick={handleCopy}
                                style={{
                                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                                    padding: '4px 10px', borderRadius: '6px',
                                    background: 'rgba(255,255,255,0.1)', border: 'none',
                                    color: '#f8fafc', cursor: 'pointer', fontSize: '11px', fontWeight: 600
                                }}
                            >
                                {copied ? <><Check size={12} style={{ color: '#4ade80' }} /> Copied!</> : <><Copy size={12} /> Copy Code</>}
                            </button>
                        )}

                        <a
                            href={doc.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            download
                            style={{
                                display: 'inline-flex', alignItems: 'center', gap: '4px',
                                padding: '4px 10px', borderRadius: '6px',
                                background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', border: 'none',
                                color: '#ffffff', textDecoration: 'none', fontSize: '11px', fontWeight: 700
                            }}
                        >
                            <Download size={12} /> Download Zip
                        </a>

                        <button
                            onClick={toggleFullScreen}
                            style={{
                                background: 'none', border: 'none', color: '#94a3b8',
                                cursor: 'pointer', padding: '4px'
                            }}
                            title={isFullScreen ? "Exit Fullscreen" : "Fullscreen"}
                        >
                            {isFullScreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
                        </button>
                    </div>
                </div>

                {/* Main Body: Tree Sidebar + Code Viewer Area */}
                <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
                    {/* Left File Tree Sidebar */}
                    <div style={{
                        width: '240px',
                        background: '#0f172a',
                        borderRight: '1px solid #334155',
                        display: 'flex',
                        flexDirection: 'column',
                        flexShrink: 0
                    }}>
                        {/* Search Input */}
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

                        {/* File Tree List */}
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

                    {/* Right Code Content Viewer */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#090d16', overflow: 'hidden' }}>
                        {selectedFile ? (
                            <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'auto', position: 'relative' }}>
                                {contentLoading ? (
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', color: '#64748b', fontSize: '13px' }}>
                                        Loading file content...
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', width: '100%', fontFamily: 'Consolas, Monaco, "Fira Code", monospace', fontSize: `${fontSize}px`, lineHeight: 1.6 }}>
                                        {/* Line numbers column */}
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

                                        {/* Code lines container */}
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
                                <p style={{ margin: 0, fontSize: '13px' }}>Select a file from the repository tree on the left to view code.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default CodeVaultViewer;
