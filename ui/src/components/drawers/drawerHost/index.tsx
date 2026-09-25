import {
  ContainerOutlined,
  FileTextOutlined,
  FolderOpenOutlined,
  SkinOutlined,
  SlidersOutlined,
} from '@ant-design/icons';

import { AppManagerDrawer } from '../appManagerDrawer';
import { LogDrawer } from '../logDrawer';
import { PlaceholderPage } from '../placeholderPage';
import { ProxyBasicDrawer } from '../proxyBasicDrawer';
import { SubscriptionDrawer } from '../subscriptionDrawer';
import { UpdateCoreDrawer } from '../updateCoreDrawer';

/**
 * 全部二级页面抽屉的挂载点。
 *
 * 每个抽屉自己根据 `useDrawer().route` 决定是否展开，因此这里全部渲染即可，
 * 不需要在 App 里写 switch——新增页面只要在这里加一行。
 */
export function DrawerHost() {
  return (
    <>
      {/* 已实现 */}
      <LogDrawer />
      <SubscriptionDrawer />
      <ProxyBasicDrawer />
      <UpdateCoreDrawer />
      <AppManagerDrawer />

      {/* 待接入 bridge / kernel 的占位页面 */}
      <PlaceholderPage
        route="fileManager"
        title="模块文件管理"
        icon={<FolderOpenOutlined />}
        description="浏览与处理 /data/adb/box 下的模块文件。"
      />
      <PlaceholderPage
        route="updateWebui"
        title="更新 WebUI"
        icon={<ContainerOutlined />}
        description="检查并更新 WebUI 静态资源。"
      />
      <PlaceholderPage
        route="proxyOther"
        title="其他代理配置"
        icon={<SlidersOutlined />}
        description="调整端口、DNS 劫持与资源限制。"
      />
      <PlaceholderPage
        route="theme"
        title="主题设置"
        icon={<SkinOutlined />}
        description="调整主题、模糊、底栏与缩放。"
      />
      <PlaceholderPage
        route="about"
        title="关于"
        icon={<FileTextOutlined />}
        description="Box for Root · 面向 Android Root 环境的透明代理工具箱。"
      />
    </>
  );
}
