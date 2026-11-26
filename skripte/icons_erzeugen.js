// Erzeugt die PNG-Icons aus icons/icon.svg (Aufruf: osascript -l JavaScript skripte/icons_erzeugen.js), wie in Chords for Beginners
// icon-192 und icon-512 mit runden, durchsichtigen Ecken, die Maskable- und Apple-Varianten randlos
// (Android und iOS schneiden selbst zu). Das Motiv liegt ganz im sicheren Kreis für Maskable-Icons.
ObjC.import('AppKit');

function run(argv) {
  const args = ObjC.deepUnwrap($.NSProcessInfo.processInfo.arguments);
  const cwd = $.NSFileManager.defaultManager.currentDirectoryPath.js;
  let skript = args.find(a => /icons_erzeugen\.js$/.test(a)) || 'skripte/icons_erzeugen.js';
  if (!skript.startsWith('/')) skript = cwd + '/' + skript;
  const basis = $(skript).stringByStandardizingPath.stringByDeletingLastPathComponent.stringByDeletingLastPathComponent.js;
  const svg = $.NSString.stringWithContentsOfFileEncodingError(basis + '/icons/icon.svg', $.NSUTF8StringEncoding, null).js;
  const randlos = svg.replace(/<rect width="512" height="512" rx="112"/, '<rect width="512" height="512"');
  const tmp = $.NSTemporaryDirectory().js + 'songbook-icon-randlos.svg';
  $(randlos).writeToFileAtomicallyEncodingError(tmp, true, $.NSUTF8StringEncoding, null);

  function png(quelle, groesse, ziel) {
    const bild = $.NSImage.alloc.initWithContentsOfFile(quelle);
    if (bild.isNil()) throw new Error('SVG lässt sich nicht laden: ' + quelle);
    const rep = $.NSBitmapImageRep.alloc.initWithBitmapDataPlanesPixelsWidePixelsHighBitsPerSampleSamplesPerPixelHasAlphaIsPlanarColorSpaceNameBytesPerRowBitsPerPixel(
      null, groesse, groesse, 8, 4, true, false, $.NSDeviceRGBColorSpace, 0, 0);
    rep.size = $.NSMakeSize(groesse, groesse);
    $.NSGraphicsContext.saveGraphicsState;
    $.NSGraphicsContext.setCurrentContext($.NSGraphicsContext.graphicsContextWithBitmapImageRep(rep));
    $.NSColor.clearColor.set;
    $.NSRectFill($.NSMakeRect(0, 0, groesse, groesse));
    bild.drawInRectFromRectOperationFraction($.NSMakeRect(0, 0, groesse, groesse), $.NSZeroRect, $.NSCompositingOperationSourceOver, 1);
    $.NSGraphicsContext.restoreGraphicsState;
    rep.representationUsingTypeProperties($.NSBitmapImageFileTypePNG, $({})).writeToFileAtomically(basis + '/icons/' + ziel, true);
    return ziel + ' ' + groesse + 'x' + groesse;
  }
  const quelle = basis + '/icons/icon.svg';
  return [png(quelle, 192, 'icon-192.png'), png(quelle, 512, 'icon-512.png'), png(tmp, 512, 'icon-maskable-512.png'), png(tmp, 180, 'apple-touch-icon.png')].join('\n');
}
