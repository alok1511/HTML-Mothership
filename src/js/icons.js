/* Line icons for Mothership's own UI (drawn for Mothership, 24×24, stroke = currentColor),
   the emoji → icon mapping used across the app, and polished hover tips for buttons.
   Anything that writes an emoji label (ribbon, menus, dialogs, panels, toasts) gets the
   matching icon automatically, so plugins and older code keep working unchanged. */
(function (MS) {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  // name → path data, or [path data, extra SVG markup]
  var P = {
    sparkles: 'M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6z M18.5 14.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z',
    folderOpen: 'M3 18V6a1 1 0 0 1 1-1h5l2 2h7a1 1 0 0 1 1 1v2 M3 18l3-7h15l-3 7z',
    folders: 'M8 4h4l2 2h6a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z M4 8v11h13',
    flask: 'M9 3h6 M10 3v6l-5 9a2 2 0 0 0 1.7 3h10.6a2 2 0 0 0 1.7-3l-5-9V3 M7.5 15h9',
    download: 'M12 4v11 M7 10l5 5 5-5 M5 20h14',
    upload: 'M12 16V5 M7 9l5-5 5 5 M5 20h14',
    filePen: 'M13 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h4 M13 3l5 5h-5z M13 21l.8-3.2 5.5-5.5 2.4 2.4-5.5 5.5z',
    history: ['M12 7v5l3 2', '<circle cx="12" cy="12" r="9"/>'],
    layers: 'M12 3l9 5-9 5-9-5z M3 12.5l9 5 9-5 M3 16.5l9 5 9-5',
    printer: 'M7 9V3h10v6 M7 18H5a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2 M7 14h10v7H7z',
    refresh: 'M20 11a8 8 0 0 0-14.6-4.4L4 8 M4 4v4h4 M4 13a8 8 0 0 0 14.6 4.4L20 16 M20 20v-4h-4',
    undo: 'M9 14L4 9l5-5 M4 9h10.5a5.5 5.5 0 0 1 0 11H11',
    redo: 'M15 14l5-5-5-5 M20 9H9.5a5.5 5.5 0 0 0 0 11H13',
    scissors: ['M8.1 8.6L20 18 M8.1 15.4L20 6', '<circle cx="6" cy="7" r="2.5"/><circle cx="6" cy="17" r="2.5"/>'],
    copy: ['M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3', '<rect x="8" y="8" width="12" height="12" rx="2"/>'],
    clipboard: ['M9 12h6 M9 16h4', '<rect x="5" y="4" width="14" height="17" rx="2"/><rect x="9" y="2.5" width="6" height="3.5" rx="1"/>'],
    trash: 'M4 7h16 M10 11v6 M14 11v6 M6 7l1 13h10l1-13 M9 7V4h6v3',
    alignLeft: 'M4 6h16 M4 10h10 M4 14h16 M4 18h10',
    alignCenter: 'M4 6h16 M7 10h10 M4 14h16 M7 18h10',
    alignRight: 'M4 6h16 M10 10h10 M4 14h16 M10 18h10',
    search: ['M20 20l-4.2-4.2', '<circle cx="11" cy="11" r="7"/>'],
    eraser: 'M20 20H9 M3.7 14.3l9.6-9.6a1 1 0 0 1 1.4 0l4.6 4.6a1 1 0 0 1 0 1.4L12 18H8z M9 9l6 6',
    grid: ['M3 12h18 M12 3v18', '<rect x="3" y="3" width="18" height="18" rx="2"/>'],
    fileText: 'M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z M14 3v5h5 M9 13h6 M9 17h6',
    penLine: 'M12 20h9 M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z',
    pen: 'M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z M14 6l4 4',
    importIn: 'M12 3v11 M7.5 9.5L12 14l4.5-4.5 M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4',
    type: 'M5 7V5h14v2 M12 5v14 M9 19h6',
    image: ['M21 16l-5-5-9 9', '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.5"/>'],
    paperclip: 'M20 11.5l-8.3 8.3a5 5 0 0 1-7-7L13 4.5a3.3 3.3 0 0 1 4.7 4.7l-8.3 8.3a1.7 1.7 0 0 1-2.4-2.4L14.5 7.5',
    table: ['M3 9.5h18 M3 14.5h18 M9 4v16', '<rect x="3" y="4" width="18" height="16" rx="2"/>'],
    banner: ['M3 15h12 M3 19h8', '<rect x="3" y="4" width="18" height="7" rx="1.5"/>'],
    section: ['M3 9h18 M7 13h6', '<rect x="3" y="5" width="18" height="14" rx="2"/>'],
    columns: ['M12 4v16', '<rect x="3" y="4" width="18" height="16" rx="2"/>'],
    heading: 'M6 4v16 M18 4v16 M6 12h12',
    pilcrow: 'M13 4v16 M17 4v16 M19 4H9.5a4.5 4.5 0 0 0 0 9H13',
    bulb: 'M9 18h6 M10 21h4 M12 3a6 6 0 0 0-3.6 10.8c.7.5 1.1 1.3 1.1 2.2h5c0-.9.4-1.7 1.1-2.2A6 6 0 0 0 12 3z',
    more: ['', '<circle cx="5" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="19" cy="12" r="1.3" fill="currentColor"/>'],
    footer: ['M3 16h18 M7 19h6', '<rect x="3" y="4" width="18" height="17" rx="2"/>'],
    barChart: 'M4 20h16 M7 16v-5 M12 16V6 M17 16V9',
    lineChart: 'M4 20h16 M4 16l5-5 4 3 7-8',
    pieChart: 'M12 3a9 9 0 1 0 9 9h-9z M15 3.5A9 9 0 0 1 20.5 9H15z',
    gauge: 'M12 14l4-4 M3.5 18a9 9 0 1 1 17 0',
    calc: ['M8 7h8 M8 11h.01 M12 11h.01 M16 11h.01 M8 15h.01 M12 15h.01 M16 15v3 M8 18h.01 M12 18h.01', '<rect x="5" y="3" width="14" height="18" rx="2"/>'],
    sheet: ['M4 9h16 M4 14h16 M10 9v11 M14 4l-3 3', '<rect x="4" y="4" width="16" height="16" rx="2"/>'],
    compare: 'M12 3v18 M5 7h4 M15 7h4 M3 14l2-7 2 7a2.5 2.5 0 0 1-4 0z M17 14l2-7 2 7a2.5 2.5 0 0 1-4 0z M8 21h8',
    globe: ['M3 12h18 M12 3a14 14 0 0 1 0 18 M12 3a14 14 0 0 0 0 18', '<circle cx="12" cy="12" r="9"/>'],
    send: 'M22 2L11 13 M22 2l-7 20-4-9-9-4z',
    captions: ['M7 11h4 M13 11h4 M7 15h7 M16 15h1', '<rect x="3" y="5" width="18" height="14" rx="2"/>'],
    tabs: 'M3 8h18v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z M3 8V5a1 1 0 0 1 1-1h5l2 4 M11 8V5a1 1 0 0 1 1-1h4l2 4',
    panelTop: ['M3 9h18', '<rect x="3" y="3" width="18" height="18" rx="2"/>'],
    panelLeft: ['M9 3v18', '<rect x="3" y="3" width="18" height="18" rx="2"/>'],
    panelRight: ['M15 3v18', '<rect x="3" y="3" width="18" height="18" rx="2"/>'],
    moveV: 'M12 3v18 M8 7l4-4 4 4 M8 17l4 4 4-4',
    tag: ['M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9z', '<circle cx="7.5" cy="7.5" r="1.3"/>'],
    commentary: 'M5 4h14a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H10l-5 4V5a1 1 0 0 1 1-1 M8.5 8.5h7 M8.5 12h4',
    filter: 'M3 4h18l-7 9v6l-4 2v-8z',
    palette: ['M12 3a9 9 0 0 0 0 18c1.1 0 1.6-.8 1.6-1.5 0-1.1-1-1.5-1-2.5 0-.9.7-1.5 1.7-1.5H17a4 4 0 0 0 4-4c0-4.7-4-8.5-9-8.5z', '<circle cx="7.5" cy="11" r="1.1" fill="currentColor"/><circle cx="10" cy="7" r="1.1" fill="currentColor"/><circle cx="15" cy="7.5" r="1.1" fill="currentColor"/>'],
    brush: 'M18.4 2.6a2 2 0 0 1 2.9 2.9L12.5 14.3 9.7 11.5z M9 12.5c-2.5 0-4 1.5-4 4 0 1.4-.8 2.3-2 3 4.5 1.2 9.3-.3 9.3-4z',
    library: 'M5 4v16 M9 4v16 M13.5 4.5l4.5 15',
    font: 'M5 19l6-14 6 14 M7.4 14h7.2 M19 13v6',
    checkCircle: ['M8 12.5l3 3 5-6', '<circle cx="12" cy="12" r="9"/>'],
    settings: ['M4 6h9 M19 6h1 M4 12h3 M11 12h9 M4 18h11 M19 18h1', '<circle cx="16" cy="6" r="2.2"/><circle cx="9" cy="12" r="2.2"/><circle cx="17" cy="18" r="2.2"/>'],
    message: 'M21 12a8 8 0 0 1-11.7 7.1L4 20.5l1.4-5A8 8 0 1 1 21 12z',
    drill: ['M6 6.5v5a4 4 0 0 0 4 4h8 M15 12.5l3 3-3 3', '<circle cx="6" cy="4.5" r="2"/>'],
    order: 'M7 4v16 M3 8l4-4 4 4 M17 20V4 M13 16l4 4 4-4',
    swatches: ['', '<circle cx="8" cy="8.5" r="4"/><circle cx="16" cy="8.5" r="4"/><circle cx="12" cy="15.5" r="4"/>'],
    database: ['M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5 M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3', '<ellipse cx="12" cy="5" rx="8" ry="3"/>'],
    list: ['M9 6h12 M9 12h12 M9 18h12', '<circle cx="4.5" cy="6" r="1.1" fill="currentColor"/><circle cx="4.5" cy="12" r="1.1" fill="currentColor"/><circle cx="4.5" cy="18" r="1.1" fill="currentColor"/>'],
    laptop: ['M2 20h20', '<rect x="4" y="4" width="16" height="12" rx="1.5"/>'],
    monitor: ['M8 21h8 M12 17v4', '<rect x="3" y="3" width="18" height="14" rx="2"/>'],
    phone: ['M11 18h2', '<rect x="7" y="2.5" width="10" height="19" rx="2"/>'],
    shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z M9 12l2 2 4-4',
    lock: ['M8 11V7a4 4 0 0 1 8 0v4', '<rect x="5" y="11" width="14" height="10" rx="2"/>'],
    zoomIn: ['M20 20l-4.2-4.2 M11 8v6 M8 11h6', '<circle cx="11" cy="11" r="7"/>'],
    zoomOut: ['M20 20l-4.2-4.2 M8 11h6', '<circle cx="11" cy="11" r="7"/>'],
    fit: 'M4 9V4h5 M20 9V4h-5 M4 15v5h5 M20 15v5h-5',
    play: 'M7 4.5l12 7.5-12 7.5z',
    puzzle: 'M10 4a2 2 0 1 1 4 0v2h4a1 1 0 0 1 1 1v4h-2a2 2 0 1 0 0 4h2v4a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-4h2a2 2 0 1 0 0-4H5V7a1 1 0 0 1 1-1h4z',
    scroll: 'M8 21h9a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v11 M6 16H4v3a2 2 0 0 0 4 0v-3z M10 8h5 M10 12h5',
    book: 'M2 5h7a3 3 0 0 1 3 3v12a2.5 2.5 0 0 0-2.5-2.5H2z M22 5h-7a3 3 0 0 0-3 3v12a2.5 2.5 0 0 1 2.5-2.5H22z',
    compass: ['M15.5 8.5l-2 5-5 2 2-5z', '<circle cx="12" cy="12" r="9"/>'],
    graduation: 'M2 9l10-5 10 5-10 5z M6 11v5c3 2 9 2 12 0v-5 M22 9v6',
    help: ['M9.5 9.5a2.5 2.5 0 1 1 3.4 2.3c-.6.3-.9.9-.9 1.5v.7 M12 17h.01', '<circle cx="12" cy="12" r="9"/>'],
    info: ['M12 11v6 M12 7.5h.01', '<circle cx="12" cy="12" r="9"/>'],
    keyboard: ['M6.5 10h.01 M10 10h.01 M14 10h.01 M17.5 10h.01 M7 14h10', '<rect x="2" y="6" width="20" height="12" rx="2"/>'],
    pin: ['M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12z', '<circle cx="12" cy="9" r="2.5"/>'],
    pushpin: 'M9 3h6 M10 3v6l-3 5h10l-3-5V3 M12 14v7',
    area: ['M9 12h6', '<rect x="3" y="5" width="18" height="14" rx="2" stroke-dasharray="3.2 2.6"/>'],
    zap: 'M13 2L4 14h7l-1 8 9-12h-7z',
    pointer: 'M6 3l13 7-6 1.6L10.5 18z M13 11.6l5 5',
    close: 'M6 6l12 12 M18 6L6 18',
    plus: 'M12 5v14 M5 12h14',
    minus: 'M5 12h14',
    check: 'M5 12.5l4.5 4.5L19 7',
    link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1 M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
    note: 'M5 3h10l4 4v14H5z M15 3v4h4 M8 11h8 M8 15h8',
    eye: ['M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z', '<circle cx="12" cy="12" r="3"/>'],
    eyeOff: 'M3 3l18 18 M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3 3.9 M6.6 6.6C3.8 8.4 2 12 2 12s3.5 7 10 7a9.6 9.6 0 0 0 5.4-1.6 M9.9 9.9a3 3 0 0 0 4.2 4.2',
    warning: 'M12 3.5l9.5 17h-19z M12 10v4.5 M12 17.5h.01',
    xCircle: ['M9 9l6 6 M15 9l-6 6', '<circle cx="12" cy="12" r="9"/>'],
    sun: ['M12 2v2 M12 20v2 M4.9 4.9l1.4 1.4 M17.7 17.7l1.4 1.4 M2 12h2 M20 12h2 M4.9 19.1l1.4-1.4 M17.7 6.3l1.4-1.4', '<circle cx="12" cy="12" r="4"/>'],
    moon: 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z',
    command: 'M9 6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3z',
    traffic: ['', '<rect x="7" y="2" width="10" height="20" rx="3"/><circle cx="12" cy="7" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="12" cy="17" r="1.8"/>'],
    ruler: 'M3 8h18v8H3z M7 8v3 M11 8v4 M15 8v3 M19 8v4',
    divider: 'M3 12h18',
    diamond: 'M12 2.5l9.5 9.5-9.5 9.5L2.5 12z',
    grip: ['', '<circle cx="9" cy="6" r="1.2" fill="currentColor"/><circle cx="15" cy="6" r="1.2" fill="currentColor"/><circle cx="9" cy="12" r="1.2" fill="currentColor"/><circle cx="15" cy="12" r="1.2" fill="currentColor"/><circle cx="9" cy="18" r="1.2" fill="currentColor"/><circle cx="15" cy="18" r="1.2" fill="currentColor"/>'],
    target: ['', '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/>'],
    wand: 'M15 4V2 M15 10V8 M11.5 6h-2 M20.5 6h-2 M18 3.5l-1 1 M13 8.5l-1 1 M18 8.5l-1-1 M3 21l9.5-9.5 M11 13l1.5-1.5',
    robot: ['M12 3v3 M9 13h.01 M15 13h.01 M9.5 17h5', '<rect x="4" y="6" width="16" height="14" rx="3"/>'],
    server: ['M7 7h.01 M7 17h.01', '<rect x="3" y="3" width="18" height="8" rx="2"/><rect x="3" y="13" width="18" height="8" rx="2"/>'],
    lightning: 'M13 2L4 14h7l-1 8 9-12h-7z',
    star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z',
    arrowUp: 'M12 19V5 M5 12l7-7 7 7',
    legend: ['M10 7h10 M10 12h10 M10 17h10', '<rect x="3" y="5" width="4" height="4" rx="1"/><rect x="3" y="10" width="4" height="4" rx="1"/><rect x="3" y="15" width="4" height="4" rx="1"/>'],
    accessibility: ['M5 8l7 2 7-2 M12 10v5 M9 21l3-6 3 6', '<circle cx="12" cy="4.5" r="1.5"/>'],
    building: 'M4 21V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16 M15 9h4a1 1 0 0 1 1 1v11 M3 21h18 M8 8h3 M8 12h3 M8 16h3',
    userX: ['M16 20v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1 M17 8l4 4 M21 8l-4 4', '<circle cx="9.5" cy="7.5" r="3.5"/>'],
    receipt: 'M6 3h12v18l-3-2-3 2-3-2-3 2z M9 8h6 M9 12h6 M9 16h3',
    footnote: 'M4 5h16 M4 9h16 M4 13h10 M4 19h2 M9 19h11',
    clapper: 'M4 10h16v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z M3.6 10l-.6-3.5 15.4-2.6.6 3.5 M8 5.8l2 3.4 M13 5l2 3.4',
    arrowRight: 'M4 12h15 M13 6l6 6-6 6',
    circle: ['', '<circle cx="12" cy="12" r="8"/>'],
    delta: 'M6 20V6h12v10 M15 13l3 3 3-3',
    growth: 'M3 17l6-6 4 4 8-8 M15 7h6v6',
    inbox: 'M4 13h4l1 3h6l1-3h4 M4 13l2-8h3 M20 13l-2-8h-3 M4 13v6h16v-6 M12 3v8 M9 8l3 3 3-3',
    checklist: 'M10 6h10 M10 12h10 M10 18h10 M3.5 6l1.5 1.5L8 4.5 M3.5 12l1.5 1.5L8 10.5 M3.5 18l1.5 1.5L8 16.5',
    bug: 'M8 10h8v5a4 4 0 0 1-8 0z M12 10v9 M4 14h4 M16 14h4 M5 9l3 2 M19 9l-3 2 M5 20l3-2.5 M19 20l-3-2.5 M9 10a3 3 0 0 1 6 0',
    playCircle: ['M10 8.5l5.5 3.5-5.5 3.5z', '<circle cx="12" cy="12" r="9"/>'],
    camera: ['M4 8h3l2-3h6l2 3h3v11H4z', '<circle cx="12" cy="13" r="3.5"/>'],
    plug: 'M9 2v5 M15 2v5 M6 7h12v4a6 6 0 0 1-12 0z M12 17v5',
    moveH: 'M4 12h16 M8 8l-4 4 4 4 M16 8l4 4-4 4'
  };
  P.lightning = P.zap;

  // emoji / symbol used in labels → icon name
  var E = {
    '✨': 'sparkles', '📂': 'folderOpen', '🗂': 'folders', '🧪': 'flask', '⬇': 'download', '⬆': 'upload', '📝': 'filePen', '🕘': 'history', '📚': 'layers',
    '🖨': 'printer', '↻': 'refresh', '↶': 'undo', '↷': 'redo', '✂': 'scissors', '⧉': 'copy', '📋': 'clipboard', '🗑': 'trash',
    '⟸': 'alignLeft', '≡': 'alignCenter', '⟹': 'alignRight', '🔎': 'search', '🔍': 'search', '⌫': 'eraser', '▦': 'grid', '📄': 'fileText',
    '✍': 'penLine', '⤵': 'importIn', '🅣': 'type', '🖼': 'image', '📎': 'paperclip', '▤': 'table', '🟦': 'banner', '▭': 'area', '◫': 'columns',
    'H': 'heading', '¶': 'pilcrow', '💡': 'bulb', '⋯': 'more', '▁': 'footer', '📊': 'barChart', '📈': 'lineChart', '🔢': 'gauge', '⬒': 'panelTop',
    '◧': 'panelLeft', '◨': 'panelRight', '↕': 'moveV', '🏷': 'tag', '✎': 'pen', '⚲': 'filter', '🎨': 'palette', '🖌': 'brush', '🔤': 'font',
    '✅': 'checkCircle', '⚙': 'settings', '💬': 'message', '⤓': 'drill', '⇅': 'order', '⛁': 'database', '☰': 'list', '💻': 'laptop', '🖥': 'monitor',
    '📱': 'phone', '🛡': 'shield', '🔒': 'lock', '－': 'minus', '＋': 'plus', '⤢': 'fit', '▶': 'play', '🧩': 'puzzle', '📜': 'scroll', '📖': 'book',
    '🧭': 'compass', '🎓': 'graduation', '❓': 'help', 'ℹ': 'info', '⌨': 'keyboard', '📍': 'pin', '📌': 'pushpin', '⚡': 'zap', '☝': 'pointer',
    '✕': 'close', '✓': 'check', '🔗': 'link', '🗒': 'note', '👁': 'eye', '⚠': 'warning', '―': 'divider', '1:1': 'ruler', '▥': 'columns', '◆': 'diamond',
    '⠿': 'grip', '🚦': 'traffic', '⌘': 'command', '🤖': 'robot', '🎯': 'target', '🪄': 'wand', '☀': 'sun', '🌙': 'moon', '◔': 'pieChart', '🍩': 'pieChart', '🧮': 'calc', '📗': 'sheet', '⚖': 'compare', '📰': 'captions', '🌍': 'globe', '🚀': 'send', '−': 'minus', '+': 'plus', '⭐': 'star', '⬆️': 'arrowUp', '🔑': 'legend', '♿': 'accessibility',
    '📥': 'inbox', '🏢': 'building', '🕶': 'userX', '🧾': 'receipt', '📑': 'footnote', '🎬': 'clapper', '🗨': 'message', '➝': 'arrowRight', '◯': 'circle', '⊓': 'delta', '↗': 'growth',
    '☑': 'checklist', '🐞': 'bug', '▷': 'playCircle', '📷': 'camera', '🔌': 'plug', '⟷': 'moveH'
  };
  // symbols that are also ordinary characters: only swapped when they are the whole label
  var WHOLE_ONLY = { '◯': 1, '⊓': 1, '↗': 1, '➝': 1, '⟷': 1, '▷': 1, 'H': 1, '¶': 1, '≡': 1, '―': 1, '1:1': 1, '↕': 1, '⋯': 1, '－': 1, '＋': 1, '✓': 1, '✕': 1, '◆': 1, '⠿': 1, '▁': 1, '−': 1, '+': 1 };

  MS.ICONS = P; MS.ICON_FOR = E;
  MS.icon = function (name, cls) {
    var d = P[name] || P[E[name]]; if (!d) return document.createTextNode(name || '');
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('class', 'ic' + (cls ? ' ' + cls : ''));
    var path = Array.isArray(d) ? d[0] : d, extra = Array.isArray(d) ? d[1] : '';
    svg.innerHTML = (path ? '<path d="' + path + '"/>' : '') + extra;
    return svg;
  };
  MS.icon.has = function (x) { return !!(P[x] || E[x]); };

  /* swap emoji in the app's own text for icons, as it is rendered */
  var keys = Object.keys(E).filter(function (k) { return !WHOLE_ONLY[k]; }).sort(function (a, b) { return b.length - a.length; });
  var esc = function (s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); };
  var ANY = new RegExp('(' + keys.map(esc).join('|') + ')\\uFE0F?', 'g');
  var SKIP = { TEXTAREA: 1, INPUT: 1, SELECT: 1, OPTION: 1, CODE: 1, PRE: 1, SCRIPT: 1, STYLE: 1, KBD: 1 };
  function skip(el) {
    for (var n = el; n && n !== document.body; n = n.parentNode) {
      if (n.nodeType !== 1) continue;
      if (SKIP[n.tagName] || n.id === 'stage-frame-host' || n.isContentEditable || (n.classList && (n.classList.contains('no-icons') || n.classList.contains('prompt-out') || n.classList.contains('ic')))) return true;
    }
    return false;
  }
  function swapText(t) {
    var s = t.nodeValue, trimmed = s.trim(); if (!trimmed) return;
    var whole = trimmed.replace(/️/g, '');
    if (E[whole]) { var only = MS.icon(E[whole]); only.setAttribute('class', 'ic solo'); t.parentNode.replaceChild(only, t); return; }
    ANY.lastIndex = 0; if (!ANY.test(s)) return;
    var frag = document.createDocumentFragment(), last = 0, m; ANY.lastIndex = 0;
    while ((m = ANY.exec(s))) {
      if (m.index > last) frag.appendChild(document.createTextNode(s.slice(last, m.index)));
      frag.appendChild(MS.icon(E[m[1]]));
      last = m.index + m[0].length;
      if (s.charAt(last) === ' ' && m.index === 0) { frag.appendChild(document.createTextNode(' ')); last++; }
    }
    if (last < s.length) frag.appendChild(document.createTextNode(s.slice(last)));
    t.parentNode.replaceChild(frag, t);
  }
  MS.iconize = function (root) {
    if (!root || skip(root.nodeType === 3 ? root.parentNode : root)) return;
    if (root.nodeType === 3) return swapText(root);
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null), list = [], n;
    while ((n = w.nextNode())) list.push(n);
    list.forEach(function (t) { if (t.parentNode && !skip(t.parentNode)) swapText(t); });
  };
  MS.iconsOn = true;
  function start() {
    MS.iconize(document.body);
    new MutationObserver(function (muts) {
      if (!MS.iconsOn) return;
      muts.forEach(function (m) {
        if (m.type === 'characterData') return MS.iconize(m.target);
        Array.prototype.forEach.call(m.addedNodes, function (n) { if (n.nodeType === 1 || n.nodeType === 3) MS.iconize(n); });
      });
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  /* hover tips: a styled pop-up for any [title] in Mothership's own UI (not the dashboard) */
  var tipEl = null, tipFor = null, tipTimer = null;
  function hideTip() { clearTimeout(tipTimer); if (tipEl) tipEl.classList.remove('on'); if (tipFor && tipFor.__msTitle != null) { tipFor.setAttribute('title', tipFor.__msTitle); tipFor.__msTitle = null; } tipFor = null; }
  function showTip(el) {
    var text = el.__msTitle; if (!text) return;
    if (!tipEl) { tipEl = MS.h('div', { 'class': 'ms-uitip', role: 'tooltip' }); document.body.appendChild(tipEl); }
    var lines = text.split(/\n/), m = /^(.*?)\s*\(((?:Ctrl|Alt|Shift|F\d|Esc)[^)]*)\)\s*$/.exec(lines[0]);
    tipEl.innerHTML = '';
    var label = el.querySelector('.rl'), head = label ? label.textContent : '';
    if (head && head !== (m ? m[1] : lines[0])) tipEl.appendChild(MS.h('strong', { text: head }));
    tipEl.appendChild(MS.h('span', { text: m ? m[1] : lines[0] }));
    if (m) tipEl.appendChild(MS.h('kbd', { text: m[2] }));
    lines.slice(1).forEach(function (l) { tipEl.appendChild(MS.h('small', { text: l })); });
    var r = el.getBoundingClientRect();
    tipEl.style.left = '0px'; tipEl.style.top = '0px'; tipEl.classList.add('on');
    var tw = tipEl.offsetWidth, th = tipEl.offsetHeight;
    var x = Math.max(8, Math.min(window.innerWidth - tw - 8, r.left + r.width / 2 - tw / 2));
    var y = r.bottom + 8; if (y + th > window.innerHeight - 8) y = r.top - th - 8;
    tipEl.style.left = x + 'px'; tipEl.style.top = y + 'px';
  }
  document.addEventListener('mouseover', function (e) {
    var el = e.target.closest && e.target.closest('[title]');
    if (!el || el === tipFor || el.closest('#stage-frame-host') || el.tagName === 'IFRAME') return;
    hideTip();
    if (!el.getAttribute('title')) return;
    tipFor = el; el.__msTitle = el.getAttribute('title'); el.removeAttribute('title');
    tipTimer = setTimeout(function () { if (tipFor === el) showTip(el); }, 380);
  }, true);
  document.addEventListener('mouseout', function (e) { if (tipFor && (!e.relatedTarget || !tipFor.contains(e.relatedTarget))) hideTip(); }, true);
  document.addEventListener('mousedown', hideTip, true);
  document.addEventListener('keydown', hideTip, true);
  window.addEventListener('blur', hideTip);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})(window.MS);
