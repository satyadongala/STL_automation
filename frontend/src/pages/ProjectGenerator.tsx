import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api';
import { useStore } from '../store/useStore';
import { ChevronLeft, Download, FileJson, FileCode2, FileText, Loader2, FolderArchive } from 'lucide-react';

export const ProjectGenerator: React.FC = () => {
  const { id: projectId } = useParams<{ id: string }>();
  const [project, setProject] = useState<any>(null);
  const [previewFiles, setPreviewFiles] = useState<{ path: string; content: string }[]>([]);
  const [selectedFileIndex, setSelectedFileIndex] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  const { addToast } = useStore();

  useEffect(() => {
    const loadData = async () => {
      if (!projectId) return;
      try {
        setLoading(true);
        const [projData, previewData] = await Promise.all([
          api.getProject(projectId),
          api.getProjectPreview(projectId)
        ]);
        setProject(projData);
        setPreviewFiles(previewData || []);
        setLoading(false);
      } catch (err: any) {
        addToast(err.message, 'error');
        setLoading(false);
      }
    };
    loadData();
  }, [projectId]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-brand-500 animate-spin" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex-grow flex flex-col items-center justify-center p-8">
        <h3 className="text-xl font-bold text-text-secondary">Project Not Found</h3>
        <Link to="/projects" className="mt-4 px-4 py-2 btn-primary rounded-lg text-sm font-medium">
          Back to Projects
        </Link>
      </div>
    );
  }

  const getFileIcon = (filename: string) => {
    if (filename.endsWith('.json')) return <FileJson className="w-4 h-4 text-amber-700" />;
    if (filename.endsWith('.md')) return <FileText className="w-4 h-4 text-sky-700" />;
    return <FileCode2 className="w-4 h-4 text-indigo-700" />;
  };

  const handleDownload = async () => {
    if (!projectId || downloading) return;
    setDownloading(true);
    try {
      const res = await fetch(api.getProjectDownloadUrl(projectId));
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Download failed (${res.status})`);
      }
      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition') || '';
      const match = disposition.match(/filename="?([^"]+)"?/);
      const filename = match?.[1] || `${project.name.replace(/\s+/g, '-').toLowerCase()}-playwright.zip`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      addToast('Playwright project downloaded', 'success');
    } catch (err: any) {
      addToast(err.message || 'Download failed', 'error');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto max-w-7xl mx-auto w-full flex flex-col">
      <Link to={`/projects/${projectId}`} className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-800 hover:text-brand-700 mb-6 transition-colors self-start">
        <ChevronLeft className="w-4 h-4" /> Back to Project
      </Link>

      {/* Header */}
      <div className="glass-card p-6 rounded-2xl mb-8 flex flex-col md:flex-row md:items-center justify-between gap-6 border-brand-500/10">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-brand-800 uppercase tracking-widest mb-1">
            <span>Project Generator</span>
          </div>
          <h2 className="text-3xl font-extrabold text-text-primary">Export Playwright Project</h2>
          <p className="text-text-muted text-sm mt-1">
            Standard Playwright framework (pages, fixtures, utils, locators, hooks) with your test cases under <code className="text-brand-800">tests/</code>.
          </p>
        </div>

        <button
          onClick={handleDownload}
          disabled={downloading || previewFiles.length === 0}
          className="flex items-center gap-2 px-6 py-3 btn-primary text-white font-bold rounded-xl active:scale-95 shadow-xl shadow-brand-500/20 transition-all self-start md:self-auto disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {downloading ? <Loader2 className="w-5 h-5 animate-spin" /> : <FolderArchive className="w-5 h-5" />}
          <span>{downloading ? 'Preparing ZIP…' : 'Download ZIP'}</span>
        </button>
      </div>

      {/* Preview Area */}
      <div className="flex-1 glass-card rounded-2xl overflow-hidden flex border border-brand-200/50 min-h-[500px]">
        
        {/* Sidebar */}
        <div className="w-64 bg-white/55 border-r border-brand-200/50 flex flex-col">
          <div className="p-4 border-b border-brand-200/50">
            <h3 className="text-xs font-bold text-label uppercase tracking-wider">Generated Files</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {previewFiles.map((file, idx) => (
              <button
                key={file.path}
                onClick={() => setSelectedFileIndex(idx)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors mb-1 ${
                  selectedFileIndex === idx 
                    ? 'bg-brand-500/20 text-brand-700 border border-brand-500/30' 
                    : 'text-text-secondary hover:bg-brand-100/80 hover:text-text-primary border border-transparent'
                }`}
              >
                {getFileIcon(file.path)}
                <span className="truncate text-left">{file.path}</span>
              </button>
            ))}
            {previewFiles.length === 0 && (
              <div className="text-center p-4 text-sm text-text-secondary">No files generated. Add environments or test cases first.</div>
            )}
          </div>
        </div>

        {/* Code Viewer */}
        <div className="flex-1 flex flex-col bg-white/40">
          <div className="p-4 border-b border-brand-200/50 bg-white/45 flex items-center gap-2">
            {previewFiles[selectedFileIndex] && getFileIcon(previewFiles[selectedFileIndex].path)}
            <span className="text-sm font-bold text-text-primary font-mono">
              {previewFiles[selectedFileIndex]?.path || 'No file selected'}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {previewFiles[selectedFileIndex] ? (
              <pre className="text-xs font-mono text-text-primary leading-relaxed whitespace-pre-wrap break-all">
                <code>{previewFiles[selectedFileIndex].content}</code>
              </pre>
            ) : (
              <div className="h-full flex items-center justify-center text-brand-700 text-sm">
                Select a file to preview its contents
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
