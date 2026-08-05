import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import vaultService from "../services/vault";
import enrollmentService from "../services/enrollment";
import classroomService from "../services/classroom";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import toast from "react-hot-toast";

interface Slide {
  slideTitle: string;
  bullets: string[];
  teachingTip: string;
}

interface ReportPayload {
  classSummary?: string;
  commonMistakes?: string[];
  slideOutline?: Slide[];
}

interface Folder {
  _id: string;
  name: string;
  description?: string;
  parent: string | null;
  path: string;
  type: string;
}

interface Tag {
  _id: string;
  title: string;
  slug: string;
  description?: string;
  color?: string;
  type: string;
}

interface VaultFile {
  _id: string;
  name: string;
  title: string;
  type: string;
  url: string;
  mimeType?: string;
  fileSize?: number;
  bucket?: string;
  key?: string;
  folder: string | null;
  tags: Tag[];
  visibility: string;
  userId: string | null;
  classroomId?: string | null;
  user: {
    _id: string;
    firstName: string;
    lastName: string;
  } | null;
  challengeTitle?: string;
  challengeId?: string | null;
  reportType?: string;
  payload?: ReportPayload | null;
  createdBy: string;
  createdDate: string;
}

interface StudentOption {
  userId: string;
  displayName: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface UploadQueueItem {
  file: File;
  title: string;
  tagId: string;
  visibility: string;
  userId: string;
  targetLevel: "classroom" | "organization";
  status: "pending" | "uploading" | "success" | "failed";
  error?: string;
}

interface FileVaultProps {
  role: "admin" | "member";
}

const FileVault: React.FC<FileVaultProps> = ({ role }) => {
  const { activeClassroom, user } = useAuth();
  const [files, setFiles] = useState<VaultFile[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);

  const [selectedReport, setSelectedReport] = useState<VaultFile | null>(null);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Filters state
  const [selectedTagId, setSelectedTagId] = useState<string>("all");
  const [selectedVisibility, setSelectedVisibility] = useState("all");
  const [searchText, setSearchText] = useState("");

  // Dialog states
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showFolderDialog, setShowFolderDialog] = useState(false);
  const [showTagDialog, setShowTagDialog] = useState(false);

  // Form states - Upload File
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadTagId, setUploadTagId] = useState("");
  const [uploadVisibility, setUploadVisibility] = useState(role === "admin" ? "everyone" : "teachers");
  const [uploadUserId, setUploadUserId] = useState("");
  const [uploadTargetLevel, setUploadTargetLevel] = useState<"classroom" | "organization">("classroom");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Drag and drop states
  const [isDragging, setIsDragging] = useState(false);
  const [, setDragCounter] = useState(0);

  // Form states - Drag & Drop Upload
  const [showMultiUploadDialog, setShowMultiUploadDialog] = useState(false);
  const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[]>([]);
  const [isMultiUploading, setIsMultiUploading] = useState(false);
  const [bulkTagId, setBulkTagId] = useState("");
  const [bulkVisibility, setBulkVisibility] = useState(role === "admin" ? "everyone" : "teachers");
  const [bulkUserId, setBulkUserId] = useState("");
  const [bulkTargetLevel, setBulkTargetLevel] = useState<"classroom" | "organization">("classroom");

  // Copy File states
  const [myClassrooms, setMyClassrooms] = useState<any[]>([]);
  const [showCopyFileDialog, setShowCopyFileDialog] = useState(false);
  const [fileToCopy, setFileToCopy] = useState<VaultFile | null>(null);
  const [targetCopyClassroomId, setTargetCopyClassroomId] = useState("");
  const [isCopyingFile, setIsCopyingFile] = useState(false);

  // Form states - Create Folder
  const [folderName, setFolderName] = useState("");
  const [folderDesc, setFolderDesc] = useState("");
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);

  // Form states - Create Tag
  const [tagTitle, setTagTitle] = useState("");
  const [tagDesc, setTagDesc] = useState("");
  const [tagColor, setTagColor] = useState("#808080");
  const [isCreatingTag, setIsCreatingTag] = useState(false);

  // Classroom roster list (admin only)
  const [students, setStudents] = useState<StudentOption[]>([]);

  const classroomId = activeClassroom?._id ?? null;
  const visibilities = ["all", "everyone", "teachers", "student"];

  // Fetch folders and tags metadata (used by initial load and after create/delete)
  const loadMetadata = async () => {
    if (!classroomId) return;
    try {
      const [foldersData, tagsData] = await Promise.all([
        vaultService.getFolders(classroomId),
        vaultService.getTags(classroomId),
      ]);
      if (foldersData?.success && Array.isArray(foldersData.data)) {
        setFolders(foldersData.data);
      }
      if (tagsData?.success && Array.isArray(tagsData.data)) {
        setTags(tagsData.data);
      }
    } catch (err) {
      console.error("Failed to load vault folders/tags metadata:", err);
    }
  };

  // Helper to load files (shared by initial load and filter changes)
  const loadFiles = async () => {
    if (!classroomId) return;
    try {
      const data = await vaultService.getFiles(
        classroomId,
        currentFolderId || "root",
        selectedTagId,
        searchText
      );
      if (data?.success && Array.isArray(data.data)) {
        let filtered = data.data;
        if (role === "admin" && selectedVisibility !== "all") {
          filtered = data.data.filter((f: any) => f.visibility === selectedVisibility);
        }
        setFiles(filtered);
      }
    } catch (err: any) {
      console.error("Failed to load files:", err);
      toast.error("Failed to load vault files.");
    }
  };

  // Initial load: fetch metadata + files together so there's no flash
  useEffect(() => {
    if (!classroomId) return;
    const initialLoad = async () => {
      setIsLoading(true);
      await Promise.all([loadMetadata(), loadFiles()]);
      setIsLoading(false);
      setIsInitialLoad(false);
    };
    setIsInitialLoad(true);
    void initialLoad();
  }, [classroomId]);

  // Subsequent filter/folder changes: debounced file reload (no metadata refetch)
  useEffect(() => {
    if (!classroomId || isInitialLoad) return;

    const delayDebounceFn = setTimeout(() => {
      const reload = async () => {
        setIsLoading(true);
        await loadFiles();
        setIsLoading(false);
      };
      void reload();
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [currentFolderId, selectedTagId, selectedVisibility, searchText, role]);

  // Load classroom roster for the student selector dropdown (admin only)
  useEffect(() => {
    if (!classroomId || role !== "admin") return;
    const loadRoster = async () => {
      try {
        const response = await enrollmentService.getRoster(classroomId);
        const rosterData = response?.data ?? response ?? [];
        const formattedStudents = rosterData.map((item: any) => ({
          userId: item.userId || item._id,
          displayName: item.displayName || `${item.firstName} ${item.lastName}`,
          firstName: item.firstName || "",
          lastName: item.lastName || "",
          email: item.email || "",
        }));
        setStudents(formattedStudents);
      } catch (err) {
        console.error("Failed to load students roster for vault dropdown:", err);
      }
    };
    void loadRoster();
  }, [classroomId, role]);

  // Fetch all classrooms for copy files utility (admin only)
  useEffect(() => {
    if (role !== "admin") return;
    const loadClassrooms = async () => {
      try {
        const response = await classroomService.getAll();
        const classes = response?.data ?? response ?? [];
        if (Array.isArray(classes)) {
          setMyClassrooms(classes);
        }
      } catch (err) {
        console.error("Failed to load classrooms for copy dropdown:", err);
      }
    };
    void loadClassrooms();
  }, [role]);

  const openFile = (file: VaultFile) => {
    if (file.payload && file.payload.slideOutline && file.payload.slideOutline.length > 0) {
      setSelectedReport(file);
      setCurrentSlideIndex(0);
    } else if (file.url) {
      window.open(file.url, "_blank");
    }
  };

  const handleNextSlide = () => {
    if (selectedReport?.payload?.slideOutline && currentSlideIndex < selectedReport.payload.slideOutline.length - 1) {
      setCurrentSlideIndex(currentSlideIndex + 1);
    }
  };

  const handlePrevSlide = () => {
    if (currentSlideIndex > 0) {
      setCurrentSlideIndex(currentSlideIndex - 1);
    }
  };

  const handleUpload = async () => {
    if (!uploadFile) {
      toast.error("Please select a file to upload.");
      return;
    }
    if (role === "admin" && uploadVisibility === "student" && !uploadUserId) {
      toast.error("Please select a student for student-specific visibility.");
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", uploadFile);
      formData.append("title", uploadTitle || uploadFile.name);
      formData.append("visibility", uploadVisibility);
      if (role === "admin" && uploadVisibility === "student") {
        formData.append("userId", uploadUserId);
      }
      if (currentFolderId) {
        formData.append("folder", currentFolderId);
      }
      if (uploadTagId) {
        formData.append("tags", JSON.stringify([uploadTagId]));
      }
      if (role === "admin") {
        formData.append("targetLevel", uploadTargetLevel);
      }

      await vaultService.uploadFile(classroomId!, formData);
      toast.success("File uploaded successfully!");
      setShowUploadDialog(false);

      // Reset upload state
      setUploadTitle("");
      setUploadTagId("");
      setUploadVisibility(role === "admin" ? "everyone" : "teachers");
      setUploadUserId("");
      setUploadTargetLevel("classroom");
      setUploadFile(null);

      // Refresh files list
      const data = await vaultService.getFiles(
        classroomId!,
        currentFolderId || "root",
        selectedTagId,
        searchText
      );
      if (data?.success && Array.isArray(data.data)) {
        let filtered = data.data;
        if (role === "admin" && selectedVisibility !== "all") {
          filtered = data.data.filter((f: any) => f.visibility === selectedVisibility);
        }
        setFiles(filtered);
      }
    } catch (err: any) {
      console.error("Upload failed:", err);
      toast.error(err.response?.data?.error || "Failed to upload file.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleCreateFolder = async () => {
    if (!folderName.trim()) {
      toast.error("Please enter a folder name.");
      return;
    }
    setIsCreatingFolder(true);
    try {
      await vaultService.createFolder(classroomId!, {
        name: folderName.trim(),
        description: folderDesc.trim(),
        parent: currentFolderId,
        path: currentFolderId ? `${currentFolderId}/${folderName}` : folderName,
        type: "file",
      });
      toast.success("Folder created successfully!");
      setShowFolderDialog(false);
      setFolderName("");
      setFolderDesc("");
      await loadMetadata();
    } catch (err: any) {
      console.error("Folder creation failed:", err);
      toast.error(err.response?.data?.error || "Failed to create folder.");
    } finally {
      setIsCreatingFolder(false);
    }
  };

  const handleCreateTag = async () => {
    if (!tagTitle.trim()) {
      toast.error("Please enter a tag name.");
      return;
    }
    setIsCreatingTag(true);
    try {
      await vaultService.createTag(classroomId!, {
        title: tagTitle.trim(),
        description: tagDesc.trim(),
        color: tagColor,
        type: "file",
      });
      toast.success("Tag created successfully!");
      setShowTagDialog(false);
      setTagTitle("");
      setTagDesc("");
      setTagColor("#808080");
      await loadMetadata();
    } catch (err: any) {
      console.error("Tag creation failed:", err);
      toast.error(err.response?.data?.error || "Failed to create tag.");
    } finally {
      setIsCreatingTag(false);
    }
  };

  const handleDeleteFile = async (e: React.MouseEvent, fileId: string) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this file from the vault? This cannot be undone.")) return;

    try {
      await vaultService.deleteFile(classroomId!, fileId);
      toast.success("File deleted successfully!");

      // Refresh files list
      const data = await vaultService.getFiles(
        classroomId!,
        currentFolderId || "root",
        selectedTagId,
        searchText
      );
      if (data?.success && Array.isArray(data.data)) {
        let filtered = data.data;
        if (role === "admin" && selectedVisibility !== "all") {
          filtered = data.data.filter((f: any) => f.visibility === selectedVisibility);
        }
        setFiles(filtered);
      }
    } catch (err: any) {
      console.error("Delete failed:", err);
      toast.error(err.response?.data?.error || "Failed to delete file.");
    }
  };

  const handleDeleteFolder = async (e: React.MouseEvent, folderId: string) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this folder? Files in it will be unassigned from this folder.")) return;

    try {
      await vaultService.deleteFolder(classroomId!, folderId);
      toast.success("Folder deleted successfully!");
      await loadMetadata();
      // Reset current folder back to root if current folder was deleted
      if (currentFolderId === folderId) {
        setCurrentFolderId(null);
      }
    } catch (err: any) {
      console.error("Delete folder failed:", err);
      toast.error(err.response?.data?.error || "Failed to delete folder.");
    }
  };

  const handleDeleteTag = async (e: React.MouseEvent, tagId: string) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this tag? References on files will be removed.")) return;

    try {
      await vaultService.deleteTag(classroomId!, tagId);
      toast.success("Tag deleted successfully!");
      if (selectedTagId === tagId) {
        setSelectedTagId("all");
      }
      await loadMetadata();
    } catch (err: any) {
      console.error("Delete tag failed:", err);
      toast.error(err.response?.data?.error || "Failed to delete tag.");
    }
  };

  // Drag and drop event handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter((prev) => prev + 1);
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter((prev) => {
      const newVal = prev - 1;
      if (newVal <= 0) {
        setIsDragging(false);
        return 0;
      }
      return newVal;
    });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    setDragCounter(0);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const filesArray = Array.from(e.dataTransfer.files);
      const initialQueueItems: UploadQueueItem[] = filesArray.map((file) => ({
        file,
        title: file.name,
        tagId: "",
        visibility: role === "admin" ? "everyone" : "teachers",
        userId: "",
        targetLevel: "classroom",
        status: "pending",
      }));
      setUploadQueue(initialQueueItems);
      setShowMultiUploadDialog(true);
    }
  };

  // Upload queue item manipulation functions
  const updateQueueItem = (index: number, fields: Partial<UploadQueueItem>) => {
    setUploadQueue((prev) => {
      const newQueue = [...prev];
      if (newQueue[index]) {
        newQueue[index] = { ...newQueue[index], ...fields };
      }
      return newQueue;
    });
  };

  const removeQueueItem = (index: number) => {
    setUploadQueue((prev) => prev.filter((_, idx) => idx !== index));
  };

  const applyBulkOptions = () => {
    setUploadQueue((prev) =>
      prev.map((item) => {
        if (item.status === "success" || item.status === "uploading") return item;
        return {
          ...item,
          tagId: bulkTagId,
          visibility: bulkVisibility,
          userId: bulkVisibility === "student" ? bulkUserId : "",
          targetLevel: bulkTargetLevel,
        };
      })
    );
    toast.success("Applied bulk settings to all pending files!");
  };

  // Asynchronous multi-file uploading orchestration
  const handleMultiUpload = async () => {
    if (!classroomId) return;
    if (uploadQueue.length === 0) {
      toast.error("No files in the upload queue.");
      return;
    }

    const missingStudentIndex = uploadQueue.findIndex(
      (item) => item.visibility === "student" && !item.userId
    );
    if (role === "admin" && missingStudentIndex !== -1) {
      toast.error(`Please select a student for "${uploadQueue[missingStudentIndex].title}".`);
      return;
    }

    setIsMultiUploading(true);

    const uploadItem = async (index: number) => {
      const item = uploadQueue[index];
      if (item.status === "success") return;

      updateQueueItem(index, { status: "uploading", error: undefined });

      try {
        const formData = new FormData();
        formData.append("file", item.file);
        formData.append("title", item.title || item.file.name);
        formData.append("visibility", item.visibility);
        if (role === "admin" && item.visibility === "student") {
          formData.append("userId", item.userId);
        }
        if (currentFolderId) {
          formData.append("folder", currentFolderId);
        }
        if (item.tagId) {
          formData.append("tags", JSON.stringify([item.tagId]));
        }
        if (role === "admin") {
          formData.append("targetLevel", item.targetLevel);
        }

        await vaultService.uploadFile(classroomId, formData);
        updateQueueItem(index, { status: "success" });
      } catch (err: any) {
        console.error(`Upload failed for ${item.file.name}:`, err);
        const errMsg = err.response?.data?.error || "Upload failed";
        updateQueueItem(index, { status: "failed", error: errMsg });
        throw err;
      }
    };

    const promises = uploadQueue.map((_, idx) => uploadItem(idx));
    await Promise.allSettled(promises);

    setIsMultiUploading(false);

    setUploadQueue((currentQueue) => {
      const allSuccess = currentQueue.every((item) => item.status === "success");
      if (allSuccess) {
        toast.success("All files uploaded successfully!");
        setShowMultiUploadDialog(false);
        setUploadQueue([]);
      } else {
        const successCount = currentQueue.filter((item) => item.status === "success").length;
        const failCount = currentQueue.filter((item) => item.status === "failed").length;
        toast.error(`Completed with errors. Succeeded: ${successCount}, Failed: ${failCount}`);
      }
      return currentQueue;
    });

    try {
      const data = await vaultService.getFiles(
        classroomId,
        currentFolderId || "root",
        selectedTagId,
        searchText
      );
      if (data?.success && Array.isArray(data.data)) {
        let filtered = data.data;
        if (role === "admin" && selectedVisibility !== "all") {
          filtered = data.data.filter((f: any) => f.visibility === selectedVisibility);
        }
        setFiles(filtered);
      }
    } catch (err) {
      console.error("Failed to reload files after multi-upload:", err);
    }
  };

  // Copy file to another classroom utility (admin only)
  const handleCopyFile = async () => {
    if (!classroomId || !fileToCopy || !targetCopyClassroomId) {
      toast.error("Please select a target classroom.");
      return;
    }

    setIsCopyingFile(true);
    try {
      await vaultService.copyFile(classroomId, fileToCopy._id, targetCopyClassroomId);
      toast.success(`Copied "${fileToCopy.title}" successfully!`);
      setShowCopyFileDialog(false);
      setFileToCopy(null);
      setTargetCopyClassroomId("");
    } catch (err: any) {
      console.error("Failed to copy file:", err);
      toast.error(err.response?.data?.error || "Failed to copy file.");
    } finally {
      setIsCopyingFile(false);
    }
  };

  const formatBytes = (bytes: number | null, decimals = 2) => {
    if (bytes === null || bytes === undefined) return "";
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
  };

  // Find folders to display in current folder level
  const displayedFolders = folders.filter(
    (f) => f.parent === currentFolderId || (currentFolderId === null && !f.parent)
  );

  // Find parent folder for navigation back
  const currentFolder = folders.find((f) => f._id === currentFolderId);

  // Dropdown options lists
  const singleTagOptions = uploadTargetLevel === "organization"
    ? [{ label: "-- No Tag (Org Level) --", value: "" }]
    : [
      { label: "-- No Tag --", value: "" },
      ...tags.map((tag) => ({ label: tag.title, value: tag._id })),
    ];

  const visibilityOptions = role === "admin"
    ? [
      { label: "Share Class-Wide", value: "everyone" },
      { label: "Instructors Only (Private)", value: "teachers" },
      { label: "Specific Student", value: "student" },
    ]
    : [
      { label: "Share with Instructors", value: "teachers" },
      { label: "Share with Class", value: "everyone" },
    ];

  const scopeOptions = [
    { label: "Classroom specific (Current Class)", value: "classroom" },
    { label: "Organization-wide (Shared across all classes)", value: "organization" },
  ];

  const studentOptions = [
    { label: "-- Choose a Student --", value: "" },
    ...students.map((student) => ({
      label: `${student.displayName} (${student.email})`,
      value: student.userId,
    })),
  ];

  const bulkScopeOptions = [
    { label: "Classroom specific", value: "classroom" },
    { label: "Organization-wide", value: "organization" },
  ];

  const bulkTagOptions = bulkTargetLevel === "organization"
    ? [{ label: "-- No Tag (Org Level) --", value: "" }]
    : [
      { label: "-- No Tag --", value: "" },
      ...tags.map((tag) => ({ label: tag.title, value: tag._id })),
    ];

  const bulkVisibilityOptions = role === "admin"
    ? [
      { label: "Share Class-Wide", value: "everyone" },
      { label: "Instructors Only (Private)", value: "teachers" },
      { label: "Specific Student", value: "student" },
    ]
    : [
      { label: "Share with Instructors", value: "teachers" },
      { label: "Share with Class", value: "everyone" },
    ];

  const bulkStudentOptions = [
    { label: "-- Choose a Student --", value: "" },
    ...students.map((student) => ({
      label: student.displayName,
      value: student.userId,
    })),
  ];

  const itemVisibilityOptions = role === "admin"
    ? [
      { label: "Share Class-Wide", value: "everyone" },
      { label: "Instructors Only", value: "teachers" },
      { label: "Specific Student", value: "student" },
    ]
    : [
      { label: "Instructors Only", value: "teachers" },
      { label: "Share Class-Wide", value: "everyone" },
    ];

  const scopeItemOptions = [
    { label: "Classroom", value: "classroom" },
    { label: "Org-Wide", value: "organization" },
  ];

  const itemStudentOptions = [
    { label: "-- Choose --", value: "" },
    ...students.map((student) => ({
      label: student.displayName,
      value: student.userId,
    })),
  ];

  const targetClassroomOptions = [
    { label: "-- Choose a Classroom --", value: "" },
    ...myClassrooms
      .filter((c) => c._id !== classroomId)
      .map((c) => ({
        label: c.name,
        value: c._id,
      })),
  ];

  return (
    <div
      className="relative min-h-[400px]"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragging && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/70 backdrop-blur-xs border-2 border-dashed border-brand-teal rounded-xl transition-all duration-200 pointer-events-none">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-2xl flex flex-col items-center text-center max-w-sm">
            <div className="w-16 h-16 rounded-full bg-brand-teal/10 flex items-center justify-center text-brand-teal text-3xl mb-4 animate-bounce">
              <i className="pi pi-upload" />
            </div>
            <h3 className="font-bold text-slate-100 text-lg">Drop Files Here</h3>
            <p className="text-slate-400 text-sm mt-2">
              Release to configure options and upload to the vault.
            </p>
          </div>
        </div>
      )}
      {/* Header */}
      <div className="card flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
        <div>
          <h1 className="heading-xl flex items-center gap-2">
            <i className="pi pi-folder-open text-brand-teal text-2xl" />{" "}
            {role === "admin" ? "Classroom Vault" : "File Vault"}
          </h1>
          <p className="text-text-muted text-sm mt-1">
            {role === "admin"
              ? "Access, upload, and organize classroom summaries, slides, reports, and templates into folders."
              : "Access your reports, files, slides, and class files organized by folders and categories."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          {role === "admin" && (
            <>
              <button
                onClick={() => setShowFolderDialog(true)}
                className="px-3 py-1.5 text-xs bg-ui-surface border border-ui-border text-text-primary rounded-lg font-semibold flex items-center gap-1.5 hover:bg-ui-muted transition-all cursor-pointer shadow-sm"
              >
                <i className="pi pi-folder text-sm" /> New Folder
              </button>
              <button
                onClick={() => setShowTagDialog(true)}
                className="px-3 py-1.5 text-xs bg-ui-surface border border-ui-border text-text-primary rounded-lg font-semibold flex items-center gap-1.5 hover:bg-ui-muted transition-all cursor-pointer shadow-sm"
              >
                <i className="pi pi-tag text-sm" /> New Tag
              </button>
            </>
          )}
          <button
            onClick={() => setShowUploadDialog(true)}
            className="btn-teal text-sm font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <i className="pi pi-upload text-sm" /> Upload File
          </button>
          {role === "member" && (
            <span className="text-xs font-semibold px-2.5 py-1.5 rounded bg-brand-teal/10 text-brand-teal flex items-center shadow-xs">
              {files.length} Files
            </span>
          )}
        </div>
      </div>

      {/* Vault Main Container */}
      <div className="card space-y-6 bg-ui-surface border border-ui-border rounded-xl p-6 shadow-sm">
        {/* Filter Toolbar */}
        <div className="space-y-4">
          <div className="grid grid-cols-12 gap-4 items-start">
            {/* Tag selector pills */}
            <div className="col-span-12 md:col-span-8 lg:col-span-9 space-y-1.5">
              <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider block">Filter by Tag</span>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setSelectedTagId("all")}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${selectedTagId === "all"
                    ? "bg-brand-teal text-text-primary font-semibold shadow-sm"
                    : "bg-ui-muted text-text-secondary hover:bg-ui-muted/80"
                    }`}
                >
                  All Tags
                </button>
                {tags.map((tag) => (
                  <span
                    key={tag._id}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 border border-transparent whitespace-nowrap ${selectedTagId === tag._id
                      ? "bg-brand-teal text-text-primary font-semibold shadow-sm"
                      : "bg-ui-muted text-text-secondary hover:bg-ui-muted/80 hover:text-text-primary"
                      }`}
                  >
                    <button onClick={() => setSelectedTagId(tag._id)} className="flex items-center gap-1 cursor-pointer whitespace-nowrap">
                      {tag.color && (
                        <span
                          className="w-2 h-2 rounded-full block"
                          style={{ backgroundColor: tag.color }}
                        />
                      )}
                      <span>{tag.title}</span>
                    </button>
                    {role === "admin" && (
                      <button
                        onClick={(e) => handleDeleteTag(e, tag._id)}
                        className="ml-1 hover:text-red-400 font-bold leading-none text-text-muted transition-colors cursor-pointer"
                        title="Delete Tag"
                      >
                        &times;
                      </button>
                    )}
                  </span>
                ))}
              </div>
            </div>

            {/* Search input */}
            <div className="col-span-12 md:col-span-4 lg:col-span-3 space-y-1.5">
              <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider block">Search</span>
              <span className="w-full flex items-center gap-2 bg-ui-muted border border-ui-border rounded-lg px-3 py-1.5">
                <i className="pi pi-search text-text-muted text-sm" />
                <input
                  type="text"
                  placeholder="Search files by title..."
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  className="bg-transparent border-none outline-none text-xs text-text-primary w-full"
                />
              </span>
            </div>
          </div>

          {/* Visibility selector pills (Admin only) */}
          {role === "admin" && (
            <div className="pt-2 border-t border-ui-border space-y-1.5">
              <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider block">Filter by Visibility</span>
              <div className="flex flex-wrap gap-2">
                {visibilities.map((vis) => (
                  <button
                    key={vis}
                    onClick={() => setSelectedVisibility(vis)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${selectedVisibility === vis
                      ? "bg-brand-teal text-text-primary font-semibold shadow-sm"
                      : "bg-ui-muted text-text-secondary hover:bg-ui-muted/80"
                      }`}
                  >
                    {vis === "all" ? "All Visibilities" : vis === "teachers" ? "Instructors Only" : vis === "everyone" ? "Shared Class-Wide" : "Student Specific"}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Breadcrumb Navigation */}
        <div className="flex items-center gap-2 text-xs font-semibold text-text-secondary border-t border-ui-border pt-4">
          <span
            onClick={() => setCurrentFolderId(null)}
            className="cursor-pointer hover:text-brand-teal flex items-center gap-1"
          >
            <i className="pi pi-home" /> Root
          </span>
          {currentFolderId && (
            <>
              <i className="pi pi-chevron-right text-[10px] text-text-muted" />
              <span className="text-text-primary flex items-center gap-1">
                <i className="pi pi-folder-open text-brand-teal" /> {currentFolder?.name}
              </span>
              <button
                onClick={() => setCurrentFolderId(currentFolder?.parent || null)}
                className="ml-auto text-[10px] bg-ui-muted px-2.5 py-1 rounded text-text-secondary hover:bg-ui-muted/80 flex items-center gap-1 transition-all border border-ui-border cursor-pointer"
              >
                <i className="pi pi-arrow-left" /> Back
              </button>
            </>
          )}
        </div>

        {/* Directory Content */}
        {!isLoading && (
          <div className="space-y-6">
            {/* Folders */}
            {displayedFolders.length > 0 && (
              <div className="space-y-3">
                <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider block">Folders</span>
                <div className="grid grid-cols-12 gap-3">
                  {displayedFolders.map((folder) => (
                    <div
                      key={folder._id}
                      className="col-span-12 md:col-span-4 lg:col-span-3 flex items-center gap-2 px-3 py-2.5 border border-ui-border bg-ui-bg/40 rounded-lg cursor-pointer hover:border-brand-teal/50 hover:bg-ui-muted/30 transition-all group"
                      onClick={() => {
                        setCurrentFolderId(folder._id);
                        setSearchText("");
                      }}
                    >
                      <i className="pi pi-folder text-brand-teal text-sm shrink-0" />
                      <span className="text-sm font-medium text-text-primary truncate flex-1" title={folder.name}>
                        {folder.name}
                      </span>
                      <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                        {role === "admin" && (
                          <button
                            onClick={(e) => handleDeleteFolder(e, folder._id)}
                            className="p-1 text-text-muted hover:text-red-400 transition-colors rounded hover:bg-ui-muted cursor-pointer opacity-0 group-hover:opacity-100"
                            title="Delete Folder"
                          >
                            <i className="pi pi-trash text-xs" />
                          </button>
                        )}
                        <i className="pi pi-chevron-right text-text-muted text-[10px]" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Display Files */}
            {files.length > 0 && (
              <div className="space-y-3">
                {displayedFolders.length > 0 && (
                  <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider block pt-2">Files</span>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {files.map((file) => (
                    <div
                      key={file._id}
                      className="w-full hover:shadow-md transition-all border border-ui-border bg-ui-bg/40 rounded-lg p-5 cursor-pointer hover:border-brand-teal/50 flex flex-col justify-between"
                      onClick={() => openFile(file)}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <h4 className="font-semibold text-text-primary text-sm line-clamp-1" title={file.title}>
                            {file.title}
                          </h4>
                          <span className="text-[9px] text-text-muted shrink-0">
                            {new Date(file.createdDate).toLocaleDateString()}
                          </span>
                        </div>

                        {/* File attachment block */}
                        {file.url && file.type !== "report" ? (
                          <div className="p-3 bg-ui-surface rounded-lg flex items-center justify-between border border-ui-border text-xs mb-3">
                            <span className="text-text-primary truncate font-mono max-w-[150px]" title={file.name}>
                              {file.name}
                            </span>
                            <span className="text-text-muted">
                              {formatBytes(file.fileSize ?? null)}
                            </span>
                          </div>
                        ) : (
                          <p className="text-xs text-text-secondary line-clamp-3 mb-3 leading-relaxed">
                            {file.payload?.classSummary || "AI Generated reports outline."}
                          </p>
                        )}

                        {/* Metadata labels */}
                        <div className="flex flex-wrap gap-1">
                          {file.tags.map((tag) => (
                            <span
                              key={tag._id}
                              className="text-[10px] px-2 py-0.5 rounded bg-ui-surface text-text-secondary border border-ui-border flex items-center gap-1"
                            >
                              {tag.color && (
                                <span
                                  className="w-1.5 h-1.5 rounded-full block"
                                  style={{ backgroundColor: tag.color }}
                                />
                              )}
                              {tag.title}
                            </span>
                          ))}

                          {role === "admin" && !file.classroomId && (
                            <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 font-semibold">
                              organization-wide
                            </span>
                          )}

                          {role === "admin" && file.visibility === "teachers" && (
                            <span className="text-[10px] px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20 font-semibold">
                              instructors only
                            </span>
                          )}

                          {role === "admin" && file.visibility === "student" && (
                            <span className="text-[10px] px-2 py-0.5 rounded bg-brand-teal/10 text-brand-teal border border-brand-teal/20 font-semibold" title={file.user ? `${file.user.firstName} ${file.user.lastName}` : ""}>
                              For: {file.user ? `${file.user.firstName} ${file.user.lastName}` : "Unknown Student"}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between mt-4 pt-2 border-t border-ui-border text-xs text-text-muted">
                        {file.payload?.slideOutline ? (
                          <span className="text-brand-teal font-medium flex items-center gap-1">
                            <i className="pi pi-images" /> {file.payload.slideOutline.length} Slides
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 font-medium text-brand-teal">
                            <i className="pi pi-file" /> View File
                          </span>
                        )}

                        <div className="flex items-center gap-2">
                          {role === "admin" && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setFileToCopy(file);
                                setShowCopyFileDialog(true);
                              }}
                              className="p-1 hover:text-brand-teal text-text-muted transition-colors cursor-pointer"
                              title="Copy File to another classroom"
                            >
                              <i className="pi pi-clone" />
                            </button>
                          )}
                          {(role === "admin" || file.createdBy === user?.id) && (
                            <button
                              onClick={(e) => handleDeleteFile(e, file._id)}
                              className="p-1 hover:text-red-400 text-text-muted transition-colors cursor-pointer"
                              title="Delete File"
                            >
                              <i className="pi pi-trash" />
                            </button>
                          )}
                          <span className="text-[10px] text-text-muted">
                            ID: {file._id.slice(-6)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* No Files Empty State — shows even when folders exist */}
        {!isLoading && files.length === 0 && (
          <div className="text-center py-12 flex flex-col items-center justify-center bg-ui-bg/10 rounded-lg border border-dashed border-ui-border">
            <div className="w-14 h-14 rounded-full bg-ui-muted flex items-center justify-center text-text-secondary mb-3">
              <i className="pi pi-file text-xl" />
            </div>
            <h3 className="font-semibold text-text-primary text-base">
              {displayedFolders.length > 0 ? "No Files Here" : "Empty Folder"}
            </h3>
            <p className="text-text-secondary text-sm max-w-sm mt-1">
              {displayedFolders.length > 0
                ? "This directory has folders but no files yet. Upload or drag files to get started."
                : "There are no subfolders or files in this directory."}
            </p>
          </div>
        )}

        {/* Loading Indicator */}
        {isLoading && (
          <div className="text-center py-12 text-text-muted">
            <i className="pi pi-spin pi-spinner text-2xl mb-2" />
            <p>Loading folder...</p>
          </div>
        )}
      </div>

      {/* Interactive Report Slides Viewer */}
      {selectedReport && selectedReport.payload?.slideOutline && (
        <Dialog
          visible={!!selectedReport}
          onHide={() => setSelectedReport(null)}
          header={`${selectedReport.title} - Performance Report`}
          className="modal w-full max-w-5xl"
          maskClassName="modal-mask"
          headerClassName="modal-header"
          contentClassName="p-6"
          style={{ width: "95vw", maxWidth: "1000px" }}
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Side: Summary and Mistakes */}
            <div className="lg:col-span-5 space-y-6">
              {selectedReport.payload.classSummary && (
                <div>
                  <h3 className="text-sm font-semibold uppercase text-brand-teal tracking-wider mb-2">Round Summary</h3>
                  <p className="text-sm text-text-primary leading-relaxed bg-ui-surface p-4 border border-ui-border rounded-lg shadow-sm">
                    {selectedReport.payload.classSummary}
                  </p>
                </div>
              )}

              {selectedReport.payload.commonMistakes && selectedReport.payload.commonMistakes.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold uppercase text-brand-teal tracking-wider mb-2">Common Mistakes</h3>
                  <ul className="space-y-2 bg-ui-surface p-4 border border-ui-border rounded-lg shadow-sm">
                    {selectedReport.payload.commonMistakes.map((mistake, idx) => (
                      <li key={idx} className="flex gap-2 text-sm text-text-primary">
                        <span className="text-red-400 font-semibold">•</span>
                        <span>{mistake}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Right Side: Slides Player */}
            <div className="lg:col-span-7 flex flex-col">
              <h3 className="text-sm font-semibold uppercase text-brand-teal tracking-wider mb-2 flex items-center justify-between">
                <span>Lesson Slides</span>
                <span className="text-xs text-text-muted lowercase">
                  Slide {currentSlideIndex + 1} of {selectedReport.payload.slideOutline.length}
                </span>
              </h3>

              {/* Slide Container */}
              <div className="flex-grow bg-slate-900 text-slate-100 rounded-xl p-6 shadow-lg border border-slate-800 min-h-[320px] flex flex-col justify-between">
                <div>
                  {/* Slide Title */}
                  <h4 className="text-xl font-bold text-brand-teal mb-4 pb-2 border-b border-slate-800">
                    {selectedReport.payload.slideOutline[currentSlideIndex].slideTitle}
                  </h4>
                  {/* Bullet points */}
                  <ul className="space-y-3 mb-6">
                    {selectedReport.payload.slideOutline[currentSlideIndex].bullets.map((bullet, idx) => (
                      <li key={idx} className="flex gap-2 text-sm">
                        <span className="text-brand-teal font-semibold">✔</span>
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Instructor Tip / Coaching Box */}
                {selectedReport.payload.slideOutline[currentSlideIndex].teachingTip && (
                  <div className="bg-slate-800/80 border border-slate-700 p-4 rounded-lg">
                    <span className="text-xs uppercase font-bold text-brand-orange tracking-wider flex items-center gap-1 mb-1">
                      <i className="pi pi-lightbulb" /> Lesson Insight
                    </span>
                    <p className="text-xs text-slate-300 italic">
                      {selectedReport.payload.slideOutline[currentSlideIndex].teachingTip}
                    </p>
                  </div>
                )}
              </div>

              {/* Navigation buttons */}
              <div className="flex items-center justify-between mt-4">
                <button
                  type="button"
                  onClick={handlePrevSlide}
                  disabled={currentSlideIndex === 0}
                  className="px-4 py-2 text-sm bg-ui-surface border-ui-border text-text-primary rounded-lg font-semibold flex items-center gap-1.5 hover:bg-ui-muted disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  <i className="pi pi-chevron-left" /> Previous
                </button>
                <button
                  type="button"
                  onClick={handleNextSlide}
                  disabled={currentSlideIndex === selectedReport.payload.slideOutline.length - 1}
                  className="btn-teal text-sm font-semibold rounded-lg flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next <i className="pi pi-chevron-right" />
                </button>
              </div>
            </div>
          </div>
        </Dialog>
      )}

      {/* Upload Dialog */}
      <Dialog
        visible={showUploadDialog}
        onHide={() => !isUploading && setShowUploadDialog(false)}
        header="Upload File to Vault"
        className="modal w-full max-w-lg"
        maskClassName="modal-mask"
        headerClassName="modal-header"
        contentClassName="p-6 space-y-4"
      >
        <div className="space-y-1">
          <label className="text-xs font-semibold text-text-primary uppercase">File Title</label>
          <input
            type="text"
            placeholder={role === "admin" ? "e.g. Week 1 Performance Roster Report" : "e.g. Weekly Pizza Strategy"}
            value={uploadTitle}
            onChange={(e) => setUploadTitle(e.target.value)}
            className="input w-full bg-ui-muted text-text-primary"
            disabled={isUploading}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-text-primary uppercase">File Tag</label>
            <Dropdown
              value={uploadTagId}
              options={singleTagOptions}
              onChange={(e) => setUploadTagId(e.value)}
              className="w-full"
              disabled={isUploading || uploadTargetLevel === "organization"}
              placeholder="Select Tag"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-text-primary uppercase">Share Visibility</label>
            <Dropdown
              value={uploadVisibility}
              options={visibilityOptions}
              onChange={(e) => {
                setUploadVisibility(e.value);
                if (e.value !== "student") {
                  setUploadUserId("");
                }
              }}
              className="w-full"
              disabled={isUploading}
              placeholder="Select Visibility"
            />
          </div>
        </div>

        {role === "admin" && (
          <div className="space-y-1">
            <label className="text-xs font-semibold text-text-primary uppercase">File Level / Scope</label>
            <Dropdown
              value={uploadTargetLevel}
              options={scopeOptions}
              onChange={(e) => setUploadTargetLevel(e.value as "classroom" | "organization")}
              className="w-full"
              disabled={isUploading}
              placeholder="Select Scope"
            />
          </div>
        )}

        {/* Student selector (Admin only) */}
        {role === "admin" && uploadVisibility === "student" && (
          <div className="space-y-1">
            <label className="text-xs font-semibold text-text-primary uppercase">Select Student</label>
            <Dropdown
              value={uploadUserId}
              options={studentOptions}
              onChange={(e) => setUploadUserId(e.value)}
              className="w-full"
              disabled={isUploading}
              placeholder="Choose Student"
            />
          </div>
        )}

        <div className="space-y-1 pt-2">
          <label className="text-xs font-semibold text-text-primary uppercase block mb-1">Select File</label>
          <input
            type="file"
            onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
            className="w-full text-xs text-text-secondary file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-brand-teal/10 file:text-brand-teal hover:file:bg-brand-teal/20 file:cursor-pointer"
            disabled={isUploading}
          />
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t border-ui-border">
          <button
            type="button"
            onClick={() => setShowUploadDialog(false)}
            className="px-4 py-2 text-sm bg-ui-surface border border-ui-border text-text-primary rounded-lg font-semibold hover:bg-ui-muted transition-all"
            disabled={isUploading}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleUpload}
            className="btn-teal text-sm font-semibold rounded-lg flex items-center gap-1.5 disabled:opacity-50"
            disabled={isUploading}
          >
            {isUploading ? (
              <>
                <i className="pi pi-spin pi-spinner" /> Uploading...
              </>
            ) : (
              <>
                <i className="pi pi-upload" /> Upload File
              </>
            )}
          </button>
        </div>
      </Dialog>

      {/* Create Folder Dialog (Admin only) */}
      {role === "admin" && (
        <>
          <Dialog
            visible={showFolderDialog}
            onHide={() => !isCreatingFolder && setShowFolderDialog(false)}
            header="Create New Folder"
            className="modal w-full max-w-md"
            maskClassName="modal-mask"
            headerClassName="modal-header"
            contentClassName="p-6 space-y-4"
          >
            <div className="space-y-1">
              <label className="text-xs font-semibold text-text-primary uppercase">Folder Name</label>
              <input
                type="text"
                placeholder="e.g. Round 1 Reports"
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                className="input w-full bg-ui-muted text-text-primary"
                disabled={isCreatingFolder}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-text-primary uppercase">Description (Optional)</label>
              <input
                type="text"
                placeholder="e.g. General handouts and summary reports"
                value={folderDesc}
                onChange={(e) => setFolderDesc(e.target.value)}
                className="input w-full bg-ui-muted text-text-primary"
                disabled={isCreatingFolder}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-ui-border">
              <button
                type="button"
                onClick={() => setShowFolderDialog(false)}
                className="px-4 py-2 text-sm bg-ui-surface border border-ui-border text-text-primary rounded-lg font-semibold hover:bg-ui-muted transition-all"
                disabled={isCreatingFolder}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateFolder}
                className="btn-teal text-sm font-semibold rounded-lg flex items-center gap-1.5 disabled:opacity-50"
                disabled={isCreatingFolder}
              >
                {isCreatingFolder ? (
                  <>
                    <i className="pi pi-spin pi-spinner" /> Creating...
                  </>
                ) : (
                  <>
                    <i className="pi pi-check" /> Create Folder
                  </>
                )}
              </button>
            </div>
          </Dialog>

          {/* Create Tag Dialog */}
          <Dialog
            visible={showTagDialog}
            onHide={() => !isCreatingTag && setShowTagDialog(false)}
            header="Create New Tag"
            className="modal w-full max-w-md"
            maskClassName="modal-mask"
            headerClassName="modal-header"
            contentClassName="p-6 space-y-4"
          >
            <div className="space-y-1">
              <label className="text-xs font-semibold text-text-primary uppercase">Tag Title</label>
              <input
                type="text"
                placeholder="e.g. Study Material"
                value={tagTitle}
                onChange={(e) => setTagTitle(e.target.value)}
                className="input w-full bg-ui-muted text-text-primary"
                disabled={isCreatingTag}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-text-primary uppercase">Description (Optional)</label>
              <input
                type="text"
                placeholder="e.g. Prep slides for midterms"
                value={tagDesc}
                onChange={(e) => setTagDesc(e.target.value)}
                className="input w-full bg-ui-muted text-text-primary"
                disabled={isCreatingTag}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-text-primary uppercase block">Tag Color</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={tagColor}
                  onChange={(e) => setTagColor(e.target.value)}
                  className="w-10 h-10 border-0 rounded cursor-pointer bg-transparent"
                  disabled={isCreatingTag}
                />
                <span className="text-xs font-mono text-text-secondary uppercase">{tagColor}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-ui-border">
              <button
                type="button"
                onClick={() => setShowTagDialog(false)}
                className="px-4 py-2 text-sm bg-ui-surface border border-ui-border text-text-primary rounded-lg font-semibold hover:bg-ui-muted transition-all"
                disabled={isCreatingTag}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateTag}
                className="btn-teal text-sm font-semibold rounded-lg flex items-center gap-1.5 disabled:opacity-50"
                disabled={isCreatingTag}
              >
                {isCreatingTag ? (
                  <>
                    <i className="pi pi-spin pi-spinner" /> Creating...
                  </>
                ) : (
                  <>
                    <i className="pi pi-check" /> Create Tag
                  </>
                )}
              </button>
            </div>
          </Dialog>

          <Dialog
            visible={showMultiUploadDialog}
            onHide={() => !isMultiUploading && setShowMultiUploadDialog(false)}
            header={`Configure & Upload ${uploadQueue.length} ${uploadQueue.length === 1 ? "File" : "Files"}`}
            className="modal w-full max-w-4xl"
            maskClassName="modal-mask"
            headerClassName="modal-header"
            contentClassName="p-6 space-y-6 max-h-[85vh] overflow-y-auto"
            style={{ width: "95vw", maxWidth: "900px" }}
          >
            {/* Bulk Action Controls */}
            <div className="bg-ui-surface border border-ui-border rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-brand-teal uppercase tracking-wider">
                <i className="pi pi-th-large" />
                <span>Bulk Apply Settings (Optional)</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                {role === "admin" && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-text-secondary uppercase">Bulk Scope</label>
                    <Dropdown
                      value={bulkTargetLevel}
                      options={bulkScopeOptions}
                      onChange={(e) => setBulkTargetLevel(e.value as "classroom" | "organization")}
                      className="w-full text-xs"
                      disabled={isMultiUploading}
                      placeholder="Select Scope"
                    />
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-text-secondary uppercase">Bulk Tag</label>
                  <Dropdown
                    value={bulkTagId}
                    options={bulkTagOptions}
                    onChange={(e) => setBulkTagId(e.value)}
                    className="w-full text-xs"
                    disabled={isMultiUploading || bulkTargetLevel === "organization"}
                    placeholder="Select Tag"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-text-secondary uppercase">Bulk Share Visibility</label>
                  <Dropdown
                    value={bulkVisibility}
                    options={bulkVisibilityOptions}
                    onChange={(e) => {
                      setBulkVisibility(e.value);
                      if (e.value !== "student") {
                        setBulkUserId("");
                      }
                    }}
                    className="w-full text-xs"
                    disabled={isMultiUploading}
                    placeholder="Select Visibility"
                  />
                </div>

                {role === "admin" && bulkVisibility === "student" ? (
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-text-secondary uppercase">Bulk Select Student</label>
                    <Dropdown
                      value={bulkUserId}
                      options={bulkStudentOptions}
                      onChange={(e) => setBulkUserId(e.value)}
                      className="w-full text-xs"
                      disabled={isMultiUploading}
                      placeholder="Choose Student"
                    />
                  </div>
                ) : null}

                <div className="md:col-span-4 flex justify-end">
                  <button
                    type="button"
                    onClick={applyBulkOptions}
                    className="px-3 py-2 text-xs bg-brand-teal/10 border border-brand-teal/20 text-brand-teal rounded-lg font-semibold hover:bg-brand-teal/20 transition-all cursor-pointer shadow-xs flex items-center gap-1.5"
                    disabled={isMultiUploading}
                  >
                    <i className="pi pi-clone" /> Apply to All
                  </button>
                </div>
              </div>
            </div>

            {/* Queue List */}
            <div className="space-y-4 pt-2">
              <div className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                Files Queue ({uploadQueue.length})
              </div>
              <div className="space-y-4 divide-y divide-ui-border max-h-[40vh] overflow-y-auto pr-1">
                {uploadQueue.map((item, idx) => (
                  <div key={idx} className={`pt-4 ${idx === 0 ? "pt-0" : ""} flex flex-col gap-3`}>
                    <div className="flex items-start justify-between gap-4">
                      {/* File icon & name info */}
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="p-2.5 rounded-lg bg-ui-muted text-text-secondary">
                          <i className="pi pi-file" />
                        </span>
                        <div className="truncate">
                          <p className="text-xs font-semibold text-text-primary truncate" title={item.file.name}>
                            {item.file.name}
                          </p>
                          <p className="text-[10px] text-text-muted">
                            {formatBytes(item.file.size)}
                          </p>
                        </div>
                      </div>

                      {/* Status indicator / remove button */}
                      <div className="flex items-center gap-2">
                        {item.status === "pending" && (
                          <button
                            type="button"
                            onClick={() => removeQueueItem(idx)}
                            className="p-1 hover:text-red-400 text-text-muted transition-colors cursor-pointer"
                            title="Remove file"
                            disabled={isMultiUploading}
                          >
                            <i className="pi pi-times text-sm" />
                          </button>
                        )}
                        {item.status === "uploading" && (
                          <span className="text-xs text-brand-teal flex items-center gap-1">
                            <i className="pi pi-spin pi-spinner" /> Uploading...
                          </span>
                        )}
                        {item.status === "success" && (
                          <span className="text-xs text-emerald-400 flex items-center gap-1 font-semibold">
                            <i className="pi pi-check-circle" /> Success
                          </span>
                        )}
                        {item.status === "failed" && (
                          <span className="text-xs text-red-400 flex items-center gap-1 font-semibold" title={item.error}>
                            <i className="pi pi-exclamation-circle" /> Failed
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Edit options if pending or failed */}
                    {item.status !== "success" && item.status !== "uploading" ? (
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pl-12">
                        {/* Title */}
                        <div className={`${role === "admin" ? (item.visibility === "student" ? "md:col-span-3" : "md:col-span-3") : "md:col-span-6"} space-y-1`}>
                          <label className="text-[10px] font-bold text-text-secondary uppercase">Title</label>
                          <input
                            type="text"
                            value={item.title}
                            onChange={(e) => updateQueueItem(idx, { title: e.target.value })}
                            className="input py-1 text-xs w-full bg-ui-muted text-text-primary"
                            placeholder="File Title"
                            disabled={isMultiUploading}
                          />
                        </div>

                        {/* Tag */}
                        <div className={`${role === "admin" ? (item.visibility === "student" ? "md:col-span-2" : "md:col-span-2") : "md:col-span-3"} space-y-1`}>
                          <label className="text-[10px] font-bold text-text-secondary uppercase">Tag</label>
                          <Dropdown
                            value={item.tagId}
                            options={item.targetLevel === "organization"
                              ? [{ label: "-- No Tag (Org Level) --", value: "" }]
                              : [
                                { label: "-- No Tag --", value: "" },
                                ...tags.map(t => ({ label: t.title, value: t._id }))
                              ]
                            }
                            onChange={(e) => updateQueueItem(idx, { tagId: e.value })}
                            className="w-full text-xs [&_.p-dropdown-label]:!py-1 [&_.p-dropdown-label]:!text-xs [&_.p-dropdown-label]:!px-2"
                            disabled={isMultiUploading || item.targetLevel === "organization"}
                            placeholder="Tag"
                          />
                        </div>

                        {/* Visibility */}
                        <div className={`${role === "admin" ? (item.visibility === "student" ? "md:col-span-2" : "md:col-span-2") : "md:col-span-3"} space-y-1`}>
                          <label className="text-[10px] font-bold text-text-secondary uppercase">Visibility</label>
                          <Dropdown
                            value={item.visibility}
                            options={itemVisibilityOptions}
                            onChange={(e) => {
                              updateQueueItem(idx, {
                                visibility: e.value,
                                userId: e.value !== "student" ? "" : item.userId,
                              });
                            }}
                            className="w-full text-xs [&_.p-dropdown-label]:!py-1 [&_.p-dropdown-label]:!text-xs [&_.p-dropdown-label]:!px-2"
                            disabled={isMultiUploading}
                            placeholder="Visibility"
                          />
                        </div>

                        {/* Target Scope (Admin only) */}
                        {role === "admin" && (
                          <div className="md:col-span-2 space-y-1">
                            <label className="text-[10px] font-bold text-text-secondary uppercase">Scope</label>
                            <Dropdown
                              value={item.targetLevel}
                              options={scopeItemOptions}
                              onChange={(e) => {
                                const level = e.value as "classroom" | "organization";
                                updateQueueItem(idx, {
                                  targetLevel: level,
                                  tagId: level === "organization" ? "" : item.tagId,
                                });
                              }}
                              className="w-full text-xs [&_.p-dropdown-label]:!py-1 [&_.p-dropdown-label]:!text-xs [&_.p-dropdown-label]:!px-2"
                              disabled={isMultiUploading}
                              placeholder="Scope"
                            />
                          </div>
                        )}

                        {/* Student selector */}
                        {role === "admin" && item.visibility === "student" ? (
                          <div className="md:col-span-3 space-y-1">
                            <label className="text-[10px] font-bold text-text-secondary uppercase">Student</label>
                            <Dropdown
                              value={item.userId}
                              options={itemStudentOptions}
                              onChange={(e) => updateQueueItem(idx, { userId: e.value })}
                              className="w-full text-xs [&_.p-dropdown-label]:!py-1 [&_.p-dropdown-label]:!text-xs [&_.p-dropdown-label]:!px-2"
                              disabled={isMultiUploading}
                              placeholder="Choose"
                            />
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      // Summary display for finished uploads
                      <div className="pl-12 text-xs text-text-secondary flex flex-wrap gap-x-4 gap-y-1">
                        <span>Title: <strong className="text-text-primary">{item.title}</strong></span>
                        {item.tagId && (
                          <span>Tag: <strong className="text-text-primary">{tags.find(t => t._id === item.tagId)?.title}</strong></span>
                        )}
                        <span>Scope: <strong className="text-text-primary">{item.targetLevel === "organization" ? "Organization-wide" : "Classroom-specific"}</strong></span>
                        <span>Visibility: <strong className="text-text-primary">{item.visibility}</strong></span>
                        {item.userId && (
                          <span>Student: <strong className="text-text-primary">{students.find(s => s.userId === item.userId)?.displayName}</strong></span>
                        )}
                      </div>
                    )}

                    {/* Error message */}
                    {item.status === "failed" && item.error && (
                      <div className="pl-12 text-[10px] text-red-400 font-semibold mt-1">
                        Error: {item.error}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-4 border-t border-ui-border">
              <button
                type="button"
                onClick={() => {
                  setShowMultiUploadDialog(false);
                  setUploadQueue([]);
                }}
                className="px-4 py-2 text-sm bg-ui-surface border border-ui-border text-text-primary rounded-lg font-semibold hover:bg-ui-muted transition-all"
                disabled={isMultiUploading}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleMultiUpload}
                className="btn-teal text-sm font-semibold rounded-lg flex items-center gap-1.5 disabled:opacity-50"
                disabled={isMultiUploading || uploadQueue.length === 0}
              >
                {isMultiUploading ? (
                  <>
                    <i className="pi pi-spin pi-spinner" /> Uploading...
                  </>
                ) : (
                  <>
                    <i className="pi pi-upload" /> Upload All ({uploadQueue.length} files)
                  </>
                )}
              </button>
            </div>
          </Dialog>

          {/* Copy File Dialog (Admin only) */}
          {role === "admin" && (
            <Dialog
              visible={showCopyFileDialog}
              onHide={() => !isCopyingFile && setShowCopyFileDialog(false)}
              header={`Copy "${fileToCopy?.title || "File"}" to Another Class`}
              className="modal w-full max-w-md"
              maskClassName="modal-mask"
              headerClassName="modal-header"
              contentClassName="p-6 space-y-4"
            >
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text-primary uppercase block">Select Target Classroom</label>
                <Dropdown
                  value={targetCopyClassroomId}
                  options={targetClassroomOptions}
                  onChange={(e) => setTargetCopyClassroomId(e.value)}
                  className="w-full"
                  disabled={isCopyingFile}
                  placeholder="Choose Classroom"
                />
                <p className="text-[10px] text-text-secondary mt-1">
                  Note: The file will be copied to the root folder of the target classroom. Tags and student-specific visibilities will be cleared.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-ui-border">
                <button
                  type="button"
                  onClick={() => setShowCopyFileDialog(false)}
                  className="px-4 py-2 text-sm bg-ui-surface border border-ui-border text-text-primary rounded-lg font-semibold hover:bg-ui-muted transition-all"
                  disabled={isCopyingFile}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCopyFile}
                  className="btn-teal text-sm font-semibold rounded-lg flex items-center gap-1.5 disabled:opacity-50"
                  disabled={isCopyingFile || !targetCopyClassroomId}
                >
                  {isCopyingFile ? (
                    <>
                      <i className="pi pi-spin pi-spinner" /> Copying...
                    </>
                  ) : (
                    <>
                      <i className="pi pi-clone" /> Copy File
                    </>
                  )}
                </button>
              </div>
            </Dialog>
          )}
        </>
      )}
    </div>
  );
};

export default FileVault;
