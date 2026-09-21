import { api } from "@/lib/api";
import { getProviderName } from "@/lib/providers";
import type { FileItem } from "@/types/file";
export type SortBy="name"|"date"|"size"; export type SortDirection="asc"|"desc";
export interface ActivityEvent{id:string;action:string;resource_type?:string|null;resource_id?:string|null;details?:Record<string,unknown>;created_at:string}
export interface FileShare{id:string;file_id:string;owner_id:string;shared_with_email:string|null;permission_level:"view"|"edit"|"admin";created_at:string;expires_at:string|null}
export interface StorageProvider{id:string;user_id?:string;provider_name:string;provider_user_email?:string|null;status:string;total_space?:number|null;used_space?:number|null;priority?:number|null;created_at?:string;updated_at?:string}
const bools=(f:FileItem):FileItem=>({...f,is_folder:Boolean(f.is_folder),is_starred:Boolean(f.is_starred),is_shared:Boolean(f.is_shared)});
export async function listFiles(parentFolderId:string|null=null,sortBy:SortBy="name",direction:SortDirection="asc"){const q=new URLSearchParams();if(parentFolderId)q.set("parent",parentFolderId);q.set("sort",sortBy);q.set("direction",direction);const d=await api<{files:FileItem[]}>(`/files?${q}`);return d.files.map(bools)}
export async function listAllFiles(sortBy:SortBy="date",direction:SortDirection="desc"){const d=await api<{files:FileItem[]}>(`/files?all=1&sort=${sortBy}&direction=${direction}`);return d.files.map(bools)}
export async function getFolderPath(folderId:string){return (await api<{folders:FileItem[]}>(`/files/${folderId}/path`)).folders.map(bools)}
export async function createFolder(name:string,parent_folder_id:string|null=null){return bools((await api<{file:FileItem}>("/folders",{method:"POST",body:JSON.stringify({name,parent_folder_id})})).file)}
export interface UploadProgress{fileName:string;percent:number}
export async function uploadFile(file:File,parent_folder_id:string|null=null,onProgress?:(p:UploadProgress)=>void){onProgress?.({fileName:file.name,percent:5});const fd=new FormData();fd.set("file",file);if(parent_folder_id)fd.set("parent_folder_id",parent_folder_id);const d=await api<{file:FileItem}>("/files/upload",{method:"POST",body:fd});onProgress?.({fileName:file.name,percent:100});return bools(d.file)}
export async function deleteFile(file:FileItem){await api(`/files/${file.id}`,{method:"DELETE"})}
export async function renameFile(file:FileItem,newName:string){return bools((await api<{file:FileItem}>(`/files/${file.id}`,{method:"PATCH",body:JSON.stringify({filename:newName})})).file)}
export async function toggleStar(file:FileItem){const next=!file.is_starred;await api(`/files/${file.id}`,{method:"PATCH",body:JSON.stringify({is_starred:next})});return next}
export async function downloadFile(file:FileItem){const response=await fetch(`${(import.meta.env.VITE_API_URL||"/api").replace(/\/$/,"")}/files/${file.id}/download`,{headers:{Authorization:`Bearer ${localStorage.getItem("cloudgather_session")||""}`}});if(!response.ok)throw new Error("Could not download this file.");const url=URL.createObjectURL(await response.blob()),a=document.createElement("a");a.href=url;a.download=file.filename;a.click();URL.revokeObjectURL(url)}
export async function getPreviewUrl(file:FileItem){if(file.is_folder||!file.mime_type?.match(/^(image|text|application\/pdf)/))return null;const response=await fetch(`${(import.meta.env.VITE_API_URL||"/api").replace(/\/$/,"")}/files/${file.id}/download`,{headers:{Authorization:`Bearer ${localStorage.getItem("cloudgather_session")||""}`}});if(!response.ok)return null;return URL.createObjectURL(await response.blob())}
export async function listShares(fileId:string){return (await api<{shares:FileShare[]}>(`/files/${fileId}/shares`)).shares}
export async function shareFile(file:FileItem,email:string,permission:"view"|"edit"="view",expiresAt?:string|null){return (await api<{share:FileShare}>(`/files/${file.id}/shares`,{method:"POST",body:JSON.stringify({email,permission,expires_at:expiresAt})})).share}
export async function revokeShare(shareId:string){await api(`/shares/${shareId}`,{method:"DELETE"})}
export async function listProviders(){return (await api<{providers:StorageProvider[]}>("/providers")).providers}
export async function disconnectProvider(providerId:string){await api(`/providers/${providerId}`,{method:"DELETE"})}
export async function updateProviderOrder(orderedIds:string[]){await api("/providers/order",{method:"PATCH",body:JSON.stringify({ids:orderedIds})})}
export async function recordActivity(action:string,resourceType?:string,resourceId?:string,details:Record<string,unknown>={}){await api("/activity",{method:"POST",body:JSON.stringify({action,resourceType,resourceId,details})})}
export async function listActivity(limit=20){return (await api<{activity:ActivityEvent[]}>(`/activity?limit=${Math.min(limit,100)}`)).activity}
export {getProviderName};
