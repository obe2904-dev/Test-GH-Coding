import { ComponentProps, ReactNode } from 'react'
import { WriteContentCard } from './shared/WriteContentCard'
import { PostCreationFooter } from './shared/PostCreationFooter'

interface EditorPaneProps {
  writeContentProps: ComponentProps<typeof WriteContentCard>
  validationBanner: ReactNode
  footerProps: ComponentProps<typeof PostCreationFooter>
}

export function EditorPane({ writeContentProps, validationBanner, footerProps }: EditorPaneProps) {
  return (
    <>
      <WriteContentCard {...writeContentProps} />

      <div className="border-t border-slate-200 mt-4" />

      {validationBanner}

      <PostCreationFooter {...footerProps} />
    </>
  )
}
