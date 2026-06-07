import { useState, useRef, useEffect } from "react";
import {
  Folder,
  File as FileIcon,
  Trash2,
  Edit,
  PencilLine,
  ArrowRight,
  Upload,
  FolderUp,
  FileArchive,
  Trash,
  AlertOctagon,
  X,
  Home,
  ExternalLink,
  Github,
  TerminalSquare,
  Search,
  FileUp,
  Loader2,
} from "lucide-react";
import JSZip from "jszip";

const utf8ToB64 = (str: string) =>
  window.btoa(unescape(encodeURIComponent(str)));
const b64ToUtf8 = (str: string) => decodeURIComponent(escape(window.atob(str)));

interface GitHubItem {
  name: string;
  path: string;
  sha: string;
  size: number;
  type: "dir" | "file";
  download_url: string | null;
}

export default function App() {
  const [token, setToken] = useState(
    () => localStorage.getItem("github_token") || "",
  );
  const [owner, setOwner] = useState("kessas-djilllai");
  const [repo, setRepo] = useState("Zenix");
  const [currentPath, setCurrentPath] = useState("");
  const [files, setFiles] = useState<GitHubItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Save token when it changes
  useEffect(() => {
    localStorage.setItem("github_token", token);
  }, [token]);

  // Upload Progress State
  const [uploadProgress, setUploadProgress] = useState({
    active: false,
    current: 0,
    total: 0,
    currentFileProgress: 0,
    text: "",
  });

  // Editor Modal State
  const [editorOpen, setEditorOpen] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editPath, setEditPath] = useState("");
  const [editSha, setEditSha] = useState("");
  const [editContent, setEditContent] = useState("");
  const [savingFile, setSavingFile] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadFiles("");
  }, []);

  const getHeaders = () => {
    return token ? ({ "x-github-token": token } as Record<string, string>) : {};
  };

  const loadFiles = async (targetPath: string = "") => {
    setLoading(true);
    setCurrentPath(targetPath);
    setErrorMsg("");

    try {
      const res = await fetch(
        `/api/github/contents?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}&path=${encodeURIComponent(targetPath)}`,
        {
          headers: getHeaders(),
        },
      );
      const data = await res.json();

      if (res.ok) {
        if (Array.isArray(data)) {
          // Sort: directories first, then files
          const sorted = data.sort((a, b) => {
            if (a.type === b.type) return a.name.localeCompare(b.name);
            return a.type === "dir" ? -1 : 1;
          });
          setFiles(sorted);
        } else if (data.message) {
          setFiles([]);
          setErrorMsg(data.message);
        } else {
          setFiles([]);
        }
      } else {
        setFiles([]);
        setErrorMsg(
          data.message ||
            "خطأ في جلب الملفات. تأكد من صحة بيانات المستودع أو التوكن.",
        );
      }
    } catch (error) {
      setFiles([]);
      setErrorMsg("مشكلة في الاتصال بالشبكة.");
    } finally {
      setLoading(false);
    }
  };

  const setRepository = (e: React.FormEvent) => {
    e.preventDefault();
    if (!owner.trim() || !repo.trim()) {
      alert("يرجى إدخال اسم المستخدم واسم المستودع بشكل صحيح");
      return;
    }
    loadFiles("");
  };

  const goBack = () => {
    if (!currentPath) return;
    const parts = currentPath.split("/");
    parts.pop();
    loadFiles(parts.join("/"));
  };

  const openEditor = async (path: string, sha: string, name: string) => {
    setEditTitle(name);
    setEditPath(path);
    setEditSha(sha);
    setEditContent("جاري التحميل...");
    setEditorOpen(true);
    setSavingFile(false);

    try {
      const res = await fetch(
        `/api/github/contents?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}&path=${encodeURIComponent(path)}`,
        {
          headers: getHeaders(),
        },
      );
      const data = await res.json();
      if (data.content) {
        setEditContent(b64ToUtf8(data.content));
      } else {
        setEditContent("لا يمكن قراءة الملف.");
      }
    } catch (e) {
      setEditContent("خطأ في جلب المحتوى.");
    }
  };

  const saveEdit = async () => {
    setSavingFile(true);
    try {
      const b64Content = utf8ToB64(editContent);
      await fetch("/api/github/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getHeaders() },
        body: JSON.stringify({
          owner,
          repo,
          path: editPath,
          sha: editSha,
          content: b64Content,
        }),
      });
      setEditorOpen(false);
      loadFiles(currentPath);
    } catch (e) {
      alert("فشل حفظ الملف");
    } finally {
      setSavingFile(false);
    }
  };

  const deleteFile = async (
    path: string,
    sha: string,
    type: "dir" | "file",
  ) => {
    const confirmMsg =
      type === "dir"
        ? "سيتم حذف المجلد بجميع ملفاته نهائياً. هل أنت متأكد؟"
        : "هل أنت متأكد من الحذف؟";
    if (!window.confirm(confirmMsg)) return;

    setLoading(true);
    try {
      await fetch("/api/github/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", ...getHeaders() },
        body: JSON.stringify({ owner, repo, path, sha, type }),
      });
      loadFiles(currentPath);
    } catch (e) {
      loadFiles(currentPath);
    }
  };

  const renameFile = async (
    oldPath: string,
    sha: string,
    currentName: string,
  ) => {
    const newName = window.prompt(
      "أدخل الاسم الجديد مع الامتداد:",
      currentName,
    );
    if (!newName || newName === currentName) return;

    const newPath = currentPath ? `${currentPath}/${newName}` : newName;
    setLoading(true);

    try {
      await fetch("/api/github/rename", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getHeaders() },
        body: JSON.stringify({
          owner,
          repo,
          old_path: oldPath,
          new_path: newPath,
          sha,
        }),
      });
      loadFiles(currentPath);
    } catch (e) {
      alert("فشل في إعادة التسمية");
      loadFiles(currentPath);
    }
  };

  const deleteAll = async () => {
    if (
      !window.confirm(
        "تحذير نهائي ⚠️: سيتم حذف جميع الملفات الموجودة في المستودع الحالي! هل أنت متأكد تماماً؟",
      )
    )
      return;
    setLoading(true);
    try {
      await fetch("/api/github/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", ...getHeaders() },
        body: JSON.stringify({ owner, repo, path: "", type: "dir" }),
      });
      loadFiles("");
    } catch (e) {
      loadFiles("");
    }
  };

  const cleanActions = async () => {
    if (!window.confirm("حذف جميع سجلات Actions لهذا المستودع لتوفير المساحة؟"))
      return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/github/actions?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}`,
        {
          headers: getHeaders(),
        },
      );
      const data = await res.json();

      if (!data.workflow_runs || data.workflow_runs.length === 0) {
        alert("لا توجد سجلات لحذفها.");
        loadFiles(currentPath);
        return;
      }

      const runs = data.workflow_runs;
      for (const run of runs) {
        await fetch(
          `/api/github/actions/${run.id}?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}`,
          {
            method: "DELETE",
            headers: getHeaders(),
          },
        );
      }
      alert("تم التنظيف بنجاح.");
    } catch (e) {
      alert("حدث خطأ أثناء التنظيف.");
    }
    loadFiles(currentPath);
  };

  // Generic Uploader helper
  const performUpload = async (fileList: File[], isZip: boolean = false) => {
    let filesToUpload: { name: string; file?: File; content?: string }[] = [];

    if (isZip) {
      try {
        const file = fileList[0];
        const zip = new JSZip();
        const contents = await zip.loadAsync(file);
        const fileNames = Object.keys(contents.files).filter(
          (name) => !contents.files[name].dir,
        );

        for (const filename of fileNames) {
          const base64Content = await contents.files[filename].async("base64");
          filesToUpload.push({ name: filename, content: base64Content });
        }
      } catch (e) {
        alert("حدث خطأ أثناء قراءة ملف ZIP");
        return;
      }
    } else {
      for (const f of fileList) {
        if (f.size > 50 * 1024 * 1024) { // GitHub's limit for pure API is ~50MB safely, max 100MB
          alert(`الملف ${f.name} كبير جداً (${(f.size / 1024 / 1024).toFixed(1)} MB). الحد الأقصى للملفات عبر جيت هاب API هو 50 ميجابايت.`);
          continue;
        }
        filesToUpload.push({
          name: f.webkitRelativePath || f.name,
          file: f,
        });
      }
    }

    if (filesToUpload.length === 0) return;

    setUploadProgress({
      active: true,
      current: 0,
      total: filesToUpload.length,
      currentFileProgress: 0,
      text: "جاري التحضير...",
    });

    for (let i = 0; i < filesToUpload.length; i++) {
      const item = filesToUpload[i];
      setUploadProgress((p) => ({
        ...p,
        current: i + 1,
        currentFileProgress: 0,
        text: `جاري رفع: ${item.name}`,
      }));

      await new Promise<void>((resolve) => {
        let base64Content = item.content;

        if (!base64Content && item.file) {
          const reader = new FileReader();
          reader.onload = async (evt) => {
            if (evt.target) {
              base64Content = (evt.target.result as string).split(",")[1];
            }
            try {
              await uploadSingle(
                item.name,
                base64Content,
                `Add/Update ${item.name}`,
              );
            } catch (err: any) {
              alert(`خطأ في رفع ${item.name}:\n${err.message}`);
            }
            resolve();
          };
          reader.onerror = () => resolve();
          reader.readAsDataURL(item.file);
          return;
        }

        if (base64Content) {
          uploadSingle(item.name, base64Content, `Add/Update ${item.name}`)
            .then(() => resolve())
            .catch((err) => {
              alert(`خطأ في رفع ${item.name}:\n${err.message}`);
              resolve();
            });
        } else {
          resolve();
        }
      });
    }

    // Refresh after all are done or attempted
    setUploadProgress({
      active: false,
      current: 0,
      total: 0,
      currentFileProgress: 0,
      text: "",
    });
    loadFiles(currentPath);
  };

  const uploadSingle = async (
    relativePath: string,
    base64Content?: string,
    message?: string,
  ) => {
    if (!base64Content) return;
    const fullPath = currentPath
      ? `${currentPath}/${relativePath}`
      : relativePath;

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/github/upload");
      xhr.setRequestHeader("Content-Type", "application/json");
      if (token) {
        xhr.setRequestHeader("x-github-token", token);
      }

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percentComplete = (event.loaded / event.total) * 100;
          setUploadProgress((p) => ({
            ...p,
            currentFileProgress: percentComplete,
          }));
        }
      };

      xhr.onload = () => {
        let isSuccess = xhr.status >= 200 && xhr.status < 300;
        let responseJson: any;

        try {
          responseJson = JSON.parse(xhr.responseText);
          if (!responseJson.success && xhr.status === 200) {
            isSuccess = false; // Override if success flag is strictly false
          }
        } catch (e) {}

        if (isSuccess) {
          resolve(responseJson || xhr.responseText);
        } else {
          let errMsg = `خطأ الخادم (${xhr.status})`;
          if (responseJson && responseJson.error) {
            errMsg += ` - ${responseJson.error}`;
          } else if (
            responseJson &&
            responseJson.details &&
            responseJson.details.message
          ) {
            errMsg += ` - ${responseJson.details.message}`;
          } else if (xhr.status === 413) {
            errMsg += ` - الملف كبير جداً`;
          }
          reject(new Error(errMsg));
        }
      };

      xhr.onerror = () => reject(new Error("مشكلة في الاتصال بالشبكة"));

      xhr.send(
        JSON.stringify({
          owner,
          repo,
          path: fullPath,
          content: base64Content,
          message,
        }),
      );
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      performUpload(Array.from(e.target.files));
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleFolderUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      performUpload(Array.from(e.target.files));
      if (folderInputRef.current) folderInputRef.current.value = "";
    }
  };

  const handleZipUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      performUpload(Array.from(e.target.files), true);
      if (zipInputRef.current) zipInputRef.current.value = "";
    }
  };

  const formatSize = (kb: number) => {
    if (kb < 1024) return kb.toFixed(1) + " KB";
    return (kb / 1024).toFixed(2) + " MB";
  };

  return (
    <div
      className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800"
      dir="rtl"
    >
      {/* HEADER */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 lg:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-md">
              <Github className="w-6 h-6" />
            </div>
            <h1 className="font-bold text-xl tracking-tight hidden sm:block">
              مدير مستودعات جيتهاب
            </h1>
          </div>

          <form
            onSubmit={setRepository}
            className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-xl border border-slate-200 overflow-x-auto"
          >
            <input
              type="text"
              placeholder="توكن جيت هاب (اختياري)"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="w-28 sm:w-36 px-3 py-1.5 bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500 transition-colors text-sm"
              dir="ltr"
              title="GitHub Personal Access Token (إذا كان المستودع خاص أو صلاحية الرفع)"
            />
            <div className="w-[1px] h-6 bg-slate-200 mx-1"></div>
            <input
              type="text"
              placeholder="صاحب المستودع"
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              className="w-28 sm:w-40 px-3 py-1.5 bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500 transition-colors text-sm"
              dir="ltr"
            />
            <span className="text-slate-400 font-bold px-1">/</span>
            <input
              type="text"
              placeholder="المستودع"
              value={repo}
              onChange={(e) => setRepo(e.target.value)}
              className="w-28 sm:w-40 px-3 py-1.5 bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500 transition-colors text-sm"
              dir="ltr"
            />
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-1.5 px-4 rounded-lg flex items-center gap-2 transition-colors text-sm shadow-sm"
            >
              دخول
            </button>
          </form>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="max-w-7xl mx-auto w-full px-4 lg:px-6 py-6 flex-1 flex flex-col gap-4 relative">
        {/* Upload Progress Overlay */}
        {uploadProgress.active && (
          <div className="bg-blue-900 text-white p-5 rounded-2xl shadow-xl flex flex-col gap-3 mb-2 animate-in fade-in slide-in-from-top-4">
            <div className="flex justify-between items-center text-sm font-medium">
              <div className="flex items-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
                <span>{uploadProgress.text}</span>
              </div>
              <span dir="ltr">
                {uploadProgress.current} / {uploadProgress.total} ملف
              </span>
            </div>
            <div className="w-full bg-blue-950 h-2.5 rounded-full overflow-hidden shrink-0">
              <div
                className="bg-blue-400 h-full transition-all duration-100 ease-out"
                style={{ width: `${uploadProgress.currentFileProgress}%` }}
              ></div>
            </div>
            <div className="flex justify-between text-xs text-blue-300 font-mono">
              <span>تقدم الملف الحالي</span>
              <span dir="ltr">
                {Math.round(uploadProgress.currentFileProgress)}%
              </span>
            </div>
          </div>
        )}

        {/* Toolbar & Breadcrumbs */}
        <div className="flex flex-col md:flex-row gap-4 justify-between md:items-center bg-white p-2 pl-4 rounded-xl shadow-sm border border-slate-200">
          {/* Breadcrumb / Path */}
          <div className="flex items-center gap-2 px-2 overflow-x-auto pb-2 md:pb-0 scrollbar-hide shrink-0">
            <button
              onClick={() => loadFiles("")}
              className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors"
            >
              <Home className="w-5 h-5" />
            </button>
            <div className="h-4 w-[1px] bg-slate-300 mx-1"></div>
            <button
              onClick={goBack}
              disabled={!currentPath}
              className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors disabled:opacity-30"
            >
              <ArrowRight className="w-5 h-5" />
            </button>
            <div
              className="flex items-center text-sm font-mono text-slate-600 tracking-tight whitespace-nowrap bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100"
              dir="ltr"
            >
              <span className="text-blue-600 font-semibold">{owner}</span>
              <span className="text-slate-400 mx-1">/</span>
              <span className="text-blue-600 font-semibold">{repo}</span>
              {currentPath && (
                <>
                  <span className="text-slate-400 mx-1">/</span>
                  <span className="text-slate-700">{currentPath}</span>
                </>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 shrink-0 md:border-r border-slate-100 pr-4">
            {/* Hidden Inputs */}
            <input
              type="file"
              ref={fileInputRef}
              multiple
              onChange={handleFileUpload}
              className="hidden"
            />
            <input
              type="file"
              ref={folderInputRef}
              multiple
              onChange={handleFolderUpload}
              {...({ webkitdirectory: "true", directory: "true" } as any)}
              className="hidden"
            />
            <input
              type="file"
              ref={zipInputRef}
              accept=".zip"
              onChange={handleZipUpload}
              className="hidden"
            />

            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 shadow-sm rounded-lg hover:bg-slate-50 transition-colors"
            >
              <FileUp className="w-4 h-4 text-emerald-600" />
              رفع ملفات
            </button>
            <button
              onClick={() => folderInputRef.current?.click()}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 shadow-sm rounded-lg hover:bg-slate-50 transition-colors"
            >
              <FolderUp className="w-4 h-4 text-emerald-600" />
              رفع مجلد
            </button>
            <button
              onClick={() => zipInputRef.current?.click()}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-slate-800 shadow-sm rounded-lg hover:bg-slate-900 transition-colors"
            >
              <FileArchive className="w-4 h-4" />
              رفع وفك ZIP
            </button>

            <div className="h-6 w-[1px] bg-slate-200 mx-2 hidden sm:block"></div>

            <button
              onClick={cleanActions}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-amber-700 bg-amber-50 border border-amber-200 shadow-sm rounded-lg hover:bg-amber-100 transition-colors"
              title="تنظيف سجلات Actions"
            >
              <TerminalSquare className="w-4 h-4" />
              <span className="hidden xl:inline">تنظيف Actions</span>
            </button>
            <button
              onClick={deleteAll}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-700 bg-red-50 border border-red-200 shadow-sm rounded-lg hover:bg-red-100 transition-colors"
              title="تفريغ المستودع"
            >
              <AlertOctagon className="w-4 h-4" />
              <span className="hidden xl:inline">تفريغ</span>
            </button>
          </div>
        </div>

        {/* File Browser Table Content */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex-1 flex flex-col overflow-hidden">
          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-slate-400">
              <Loader2 className="w-10 h-10 animate-spin text-blue-500 mb-4" />
              <p className="font-medium">جاري تحديث البيانات...</p>
            </div>
          ) : errorMsg ? (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-red-500">
              <AlertOctagon className="w-12 h-12 mb-4 opacity-50" />
              <p className="font-medium text-lg">{errorMsg}</p>
            </div>
          ) : files.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-slate-400">
              <Folder className="w-16 h-16 mb-4 opacity-30 mx-auto" />
              <p className="font-medium text-lg text-slate-500">
                المستودع أو المجلد فارغ
              </p>
              <p className="text-sm mt-2">قم برفع ملفات للبدء.</p>
            </div>
          ) : (
            <div className="overflow-x-auto w-full">
              <table className="w-full text-right text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-medium tracking-wide text-xs">
                    <td className="py-3 px-4 w-12 text-center">النوع</td>
                    <td className="py-3 px-4">الاسم</td>
                    <td className="py-3 px-4 w-28 font-mono">الحجم</td>
                    <td className="py-3 px-4 w-44">إجراءات</td>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {files.map((file) => {
                    const isDir = file.type === "dir";
                    return (
                      <tr
                        key={file.sha + file.path}
                        className="hover:bg-blue-50/50 transition-colors group"
                      >
                        <td className="py-3 px-4 text-center">
                          <div
                            className={`mx-auto w-8 h-8 rounded-lg flex items-center justify-center bg-slate-100 group-hover:bg-white shadow-sm border border-slate-200/60 ${isDir ? "text-amber-500" : "text-blue-500"}`}
                          >
                            {isDir ? (
                              <Folder className="w-4 h-4 fill-amber-100 stroke-[1.5px]" />
                            ) : (
                              <FileIcon className="w-4 h-4 stroke-[1.5px]" />
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <button
                            className="font-medium text-slate-700 hover:text-blue-600 transition-colors text-right flex items-center gap-2 group-hover:translate-x-1 duration-200"
                            onClick={() =>
                              isDir
                                ? loadFiles(file.path)
                                : window.open(
                                    file.download_url || undefined,
                                    "_blank",
                                  )
                            }
                          >
                            <span dir="ltr">{file.name}</span>
                            {!isDir && file.download_url && (
                              <ExternalLink className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100" />
                            )}
                          </button>
                        </td>
                        <td
                          className="py-3 px-4 text-slate-500 font-mono text-xs"
                          dir="ltr"
                        >
                          {isDir ? "--" : formatSize(file.size)}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
                            {!isDir && (
                              <button
                                onClick={() =>
                                  openEditor(file.path, file.sha, file.name)
                                }
                                className="p-1.5 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors"
                                title="تعديل مباشر"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={() =>
                                renameFile(file.path, file.sha, file.name)
                              }
                              className="p-1.5 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
                              title="إعادة تسمية"
                            >
                              <PencilLine className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() =>
                                deleteFile(
                                  file.path,
                                  file.sha,
                                  isDir ? "dir" : "file",
                                )
                              }
                              className="p-1.5 text-red-600 bg-red-50 hover:bg-red-100 rounded-md transition-colors"
                              title="حذف"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Code Editor Modal */}
      {editorOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 sm:p-6 opacity-0 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-5xl h-[85vh] rounded-2xl flex flex-col shadow-2xl overflow-hidden scale-95 animate-in zoom-in-95 duration-200 border border-slate-200">
            {/* Modal Header */}
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                  <Edit className="w-4 h-4" />
                </div>
                <h3
                  className="text-lg font-bold text-slate-800 font-mono tracking-tight"
                  dir="ltr"
                >
                  {editTitle}
                </h3>
              </div>
              <button
                onClick={() => setEditorOpen(false)}
                className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Editor Area */}
            <div className="flex-1 bg-[#1e1e1e] relative">
              <textarea
                className="absolute inset-0 w-full h-full bg-transparent text-[#d4d4d4] p-6 font-mono text-sm resize-none outline-none leading-relaxed"
                dir="ltr"
                spellCheck="false"
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
              />
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-white border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => setEditorOpen(false)}
                className="px-6 py-2.5 font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                disabled={savingFile}
              >
                إلغاء
              </button>
              <button
                onClick={saveEdit}
                className="min-w-[140px] bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-6 rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-70 disabled:cursor-wait"
                disabled={savingFile}
              >
                {savingFile ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Upload className="w-5 h-5" />
                )}
                {savingFile ? "جاري الحفظ..." : "حفظ التعديلات"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
