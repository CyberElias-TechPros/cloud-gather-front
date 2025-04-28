
import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Home,
  HardDrive,
  Settings,
  FolderOpen,
  Cloud,
  Key
} from "lucide-react";

interface NavProps {
  isCollapsed: boolean;
}

export function Nav({ isCollapsed }: NavProps) {
  const [selected, setSelected] = useState<string>(
    useLocation().pathname
  );

  const links = [
    {
      title: "Dashboard",
      label: "",
      icon: Home,
      variant: "default",
      path: "/",
    },
    {
      title: "Files",
      label: "",
      icon: FolderOpen,
      variant: "ghost",
      path: "/files",
    },
    {
      title: "Storage",
      label: "",
      icon: HardDrive,
      variant: "ghost",
      path: "/storage",
    },
    {
      title: "Providers",
      label: "",
      icon: Cloud,
      variant: "ghost",
      path: "/providers",
    },
    {
      title: "API Docs",
      label: "New",
      icon: Key,
      variant: "ghost",
      path: "/api-docs",
    },
    {
      title: "Settings",
      label: "",
      icon: Settings,
      variant: "ghost",
      path: "/settings",
    }
  ];

  return (
    <ScrollArea className="h-[calc(100vh-64px)]">
      <div className="flex flex-col gap-2 p-2">
        {links.map((link, index) => {
          return isCollapsed ? (
            <Button
              key={index}
              variant={selected === link.path ? "default" : "ghost"}
              size="icon"
              className="h-9 w-9"
              onClick={() => setSelected(link.path)}
              asChild
            >
              <Link to={link.path}>
                <link.icon className="h-4 w-4" />
                <span className="sr-only">{link.title}</span>
              </Link>
            </Button>
          ) : (
            <Button
              key={index}
              variant={selected === link.path ? "default" : "ghost"}
              size="sm"
              className="justify-start"
              onClick={() => setSelected(link.path)}
              asChild
            >
              <Link to={link.path} className="flex items-center">
                <link.icon className="mr-2 h-4 w-4" />
                {link.title}
                {link.label && (
                  <span className="ml-auto text-xs bg-primary text-primary-foreground px-1.5 py-0.5 rounded-sm">
                    {link.label}
                  </span>
                )}
              </Link>
            </Button>
          );
        })}
      </div>
    </ScrollArea>
  );
}
