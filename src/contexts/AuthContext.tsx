import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, sessionStore } from "@/lib/api";

export type Provider = "google" | "github" | "azure";
export interface AppUser { id:string; email:string; display_name?:string|null; avatar_url?:string|null; role?:string; settings?:unknown; user_metadata?:Record<string,unknown> }
export interface AppSession { access_token:string; expires_at?:string; user:AppUser }
export interface UserProfile { id:string; display_name?:string|null; avatar_url?:string|null; role?:string|null; settings?:unknown }
export type ProfileUpdates = Partial<Pick<UserProfile,"display_name"|"avatar_url"|"settings">>;
interface AuthResult { error:Error|null; data:{user:AppUser|null;session:AppSession|null} }
interface AuthContextType { user:AppUser|null;session:AppSession|null;profile:UserProfile|null;loading:boolean;isAdmin:boolean;signIn:(email:string,password:string)=>Promise<AuthResult>;signUp:(email:string,password:string,displayName?:string)=>Promise<AuthResult>;signInWithProvider:(provider:Provider)=>Promise<{error:Error|null}>;signOut:()=>Promise<void>;resetPassword:(email:string)=>Promise<{error:Error|null}>;updatePassword:(password:string)=>Promise<{error:Error|null}>;updateProfile:(updates:ProfileUpdates)=>Promise<void> }
const AuthContext=createContext<AuthContextType|undefined>(undefined);
export function useAuth(){const value=useContext(AuthContext);if(!value)throw new Error("useAuth must be used within an AuthProvider");return value}
const normalize=(u:AppUser):AppUser=>({...u,user_metadata:{name:u.display_name,avatar_url:u.avatar_url}});
export const AuthProvider:React.FC<{children:React.ReactNode}>=({children})=>{
 const [user,setUser]=useState<AppUser|null>(null),[session,setSession]=useState<AppSession|null>(null),[loading,setLoading]=useState(true);
 const apply=useCallback((payload:{token:string;expires_at?:string;user:AppUser})=>{sessionStore.set(payload.token);const u=normalize(payload.user);setUser(u);setSession({access_token:payload.token,expires_at:payload.expires_at,user:u});return u},[]);
 useEffect(()=>{let active=true;(async()=>{if(!sessionStore.get())return;try{const {user:u}=await api<{user:AppUser}>("/auth/me");if(active){const nu=normalize(u);setUser(nu);setSession({access_token:sessionStore.get()!,user:nu})}}catch{sessionStore.clear()}finally{if(active)setLoading(false)}})();if(!sessionStore.get())setLoading(false);return()=>{active=false}},[]);
 const signIn=useCallback(async(email:string,password:string):Promise<AuthResult>=>{try{const d=await api<{token:string;expires_at:string;user:AppUser}>("/auth/login",{method:"POST",body:JSON.stringify({email,password})});const u=apply(d);return{error:null,data:{user:u,session:{access_token:d.token,expires_at:d.expires_at,user:u}}}}catch(e){return{error:e as Error,data:{user:null,session:null}}}},[apply]);
 const signUp=useCallback(async(email:string,password:string,displayName?:string):Promise<AuthResult>=>{try{const d=await api<{token:string;expires_at:string;user:AppUser}>("/auth/register",{method:"POST",body:JSON.stringify({email,password,displayName})});const u=apply(d);return{error:null,data:{user:u,session:{access_token:d.token,expires_at:d.expires_at,user:u}}}}catch(e){return{error:e as Error,data:{user:null,session:null}}}},[apply]);
 const signOut=useCallback(async()=>{try{await api("/auth/logout",{method:"POST"})}finally{sessionStore.clear();setUser(null);setSession(null)}},[]);
 const signInWithProvider=useCallback(async(provider:Provider)=>{try{const d=await api<{url:string}>(`/auth/oauth/${provider}?redirect=${encodeURIComponent(location.origin+"/login")}`);location.assign(d.url);return{error:null}}catch(e){return{error:e as Error}}},[]);
 const resetPassword=useCallback(async(email:string)=>{try{await api("/auth/password/reset",{method:"POST",body:JSON.stringify({email})});return{error:null}}catch(e){return{error:e as Error}}},[]);
 const updatePassword=useCallback(async(password:string)=>{try{await api("/auth/password",{method:"PATCH",body:JSON.stringify({password})});return{error:null}}catch(e){return{error:e as Error}}},[]);
 const updateProfile=useCallback(async(updates:ProfileUpdates)=>{const {user:u}=await api<{user:AppUser}>("/profile",{method:"PATCH",body:JSON.stringify(updates)});const nu=normalize(u);setUser(nu);setSession(s=>s?{...s,user:nu}:s)},[]);
 const profile=user?{id:user.id,display_name:user.display_name,avatar_url:user.avatar_url,role:user.role,settings:user.settings}:null;
 const value=useMemo(()=>({user,session,profile,loading,isAdmin:user?.role==="admin",signIn,signUp,signInWithProvider,signOut,resetPassword,updatePassword,updateProfile}),[user,session,profile,loading,signIn,signUp,signInWithProvider,signOut,resetPassword,updatePassword,updateProfile]);
 return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
};
