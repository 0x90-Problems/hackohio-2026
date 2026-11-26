"use client"

// A2UI's Modal drawn as a NutShell dialog (NSB-90): the same A2UI fields (trigger, content), but the
// pop-up is the app's own centred dialog, so it isn't squeezed inside the ticket window.

import { useState } from "react"
import { createComponentImplementation } from "@a2ui/react"
import { ModalApi } from "@a2ui/web_core/catalogs/basic/v1"

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"

function ModalView({ trigger, content, buildChild }: { trigger: string; content: string; buildChild: (id: string) => React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      {/* The trigger is an A2UI button; clicking anything in it opens the dialog. */}
      <span
        className="contents"
        onClickCapture={(event) => {
          event.preventDefault()
          event.stopPropagation()
          setOpen(true)
        }}
      >
        {buildChild(trigger)}
      </span>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="nutshell-a2ui max-h-[85svh] overflow-y-auto sm:max-w-xl">
          <DialogTitle className="sr-only">Details</DialogTitle>
          <DialogDescription className="sr-only">Details shared in a comment</DialogDescription>
          {buildChild(content)}
        </DialogContent>
      </Dialog>
    </>
  )
}

export const NutshellModal = createComponentImplementation(ModalApi, ({ props, buildChild }) => (
  <ModalView trigger={String(props.trigger)} content={String(props.content)} buildChild={buildChild} />
))
