# Private library work details

Each owned work has a dedicated `/library/:conceptId` route. Library list rows,
grid cards and the existing inspector link to it through **Details / View details**.
The inspector remains available for quick actions.

The `tab` search parameter persists `overview`, `resources` or `history`, including
refresh, direct navigation and browser back/forward. Detail pages are `noindex`;
`libraryDetails.get` checks ownership before reading related records and returns
the same unavailable result for malformed IDs, missing works and other owners'
works. Administrative access does not override ownership.

## Page sections

- Overview: uncropped render with accessible enlargement, configuration, saved
  palette, painting notes and the approved repaint specification.
- Resources: private image files grouped by media asset and version; metadata,
  availability and retention; downloadable plan exports; associated spray plans.
- History: recorded palette, repaint and image jobs with status, model, template
  version, requested credits and failure details.

## Resource extension

Resource collections derive from `mediaAssets.by_conceptId`, `assetVersions`, and
`storageObjects`. Adding an owned reference image, mask, export or additional
render through the existing asset system makes it discoverable without adding a
new page query. Each collection contains versions and file descriptors; presentation
can later specialize by `kind`. No upload controls or simulated resources are
included before a corresponding upload workflow exists.

Private storage keys, bucket names, raw prompts and full provider responses are
not returned by the detail query. File access reuses `assetNode.createPrivateDownloadUrl`
and its owner/plan authorization. Expired, unavailable and restricted original
files are labelled and cannot be downloaded from this page. Saved palette and
specification documents export from the displayed snapshots.

Missing legacy snapshots render explicit empty states. Current previews use
private master/preview renditions where available and retain the legacy preview
fallback for older owned assets.
