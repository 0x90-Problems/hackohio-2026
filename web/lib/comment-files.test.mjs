import assert from "node:assert/strict"
import test from "node:test"
import { attachmentsFrom, folderNamed } from "./comment-files.ts"

test("stored attachments keep only well-formed file and version pairs", () => {
  assert.deepEqual(attachmentsFrom(undefined), [])
  assert.deepEqual(attachmentsFrom("fil_1"), [])
  assert.deepEqual(
    attachmentsFrom([
      { file_id: "fil_abc123", version: 2 },
      { file_id: "fil_noversion" },
      { file_id: "", version: 1 },
      { file_id: "fil_zero", version: 0 },
      null,
      { file_id: "nte_def456", version: 1, extra: "dropped" },
    ]),
    [
      { file_id: "fil_abc123", version: 2 },
      { file_id: "nte_def456", version: 1 },
    ]
  )
})

test("the ticket folder is found the way Folders compares names", () => {
  const items = [
    { type: "file", name: "Ticket files" },
    { type: "folder", name: "ticket FILES", id: "fld_1" },
    { type: "folder", name: "Other", id: "fld_2" },
  ]
  assert.equal(folderNamed(items, "Ticket files")?.id, "fld_1")
  assert.equal(folderNamed(items, "NSB-12"), undefined)
})
