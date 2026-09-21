import { api } from "@/lib/api";
export interface BlogPost{id:number;title:string;excerpt:string;content:string;date:Date;author:string;category:string;tags:string[];image:string|null;slug:string}
type Raw=Omit<BlogPost,"date"|"tags">&{date?:string;published_at?:string;tags?:string[]|string};
const map=(p:Raw):BlogPost=>({...p,id:Number(p.id),date:new Date(p.date||p.published_at||Date.now()),tags:Array.isArray(p.tags)?p.tags:JSON.parse(p.tags||"[]")});
export async function fetchBlogPosts(){try{return(await api<{posts:Raw[]}>("/blog")).posts.map(map)}catch{return[]}}
export async function fetchBlogPostBySlug(slug:string){try{return map((await api<{post:Raw}>(`/blog/${encodeURIComponent(slug)}`)).post)}catch{return null}}
export async function fetchBlogPostsByCategory(category:string){return(await fetchBlogPosts()).filter(p=>p.category===category)}
