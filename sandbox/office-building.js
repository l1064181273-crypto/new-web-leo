// Local BoxGeometry instance data for the three-storey Little Works office.
// The scene places this model at (4.5, 0, -1.55). Five shared instance batches
// carry the construction sequence; no texture, new light or transparent pass
// is needed. The only distant/near switch is for the small `details` batch.
const COLOR = {
  wall: "#d9dfdb",
  glass: "#648798",
  frame: "#354b56",
  timber: "#aa7955",
  concrete: "#adb4b0",
  plant: "#627d67",
  light: "#f1d1a0",
};

export function createOfficeBuilding() {
  const model = {
    structure: [],
    facade: [],
    glazing: [],
    details: [],
    nightWindows: [],
    roofs: [],
  };
  const add = (group, kind, x, y, z, w, h, d, c, stage, options = {}) => {
    const entry = {
      x, y, z, w, h, d, c, stage,
      removeAt: 2,
      rx: 0,
      ry: 0,
      rz: 0,
      kind,
      ...options,
    };
    model[group].push(entry);
    return entry;
  };
  const permanent = (group, kind, x, y, z, w, h, d, c, stage, options) =>
    add(group, kind, x, y, z, w, h, d, c, stage, { duration: .018, ...options });
  const wall = (x, y, z, w, h, d, stage, paintFrom) =>
    permanent("facade", "wall", x, y, z, w, h, d, COLOR.concrete, stage, {
      paintFrom,
      paintTo: paintFrom + .015,
      paintColor: COLOR.wall,
    });

  // Preserve the original frame, stairs and early construction rhythm. Only
  // temporary rebar is reclassified: it is capped/withdrawn before 81%, never
  // left protruding through the finished roof at handover.
  add("structure", "foundation", 0, .13, 0, 4.6, .22, 4.4, "#acaca1", .14);
  for (let level = 0; level < 3; level++) {
    const y = .35 + level * 1.65;
    const stage = .24 + level * .17;
    for (const x of [-1.8, 0, 1.8]) for (const z of [-1.7, 0, 1.7]) {
      add("structure", "column", x, y + .73, z, .24, 1.45, .24, "#bbbcb3", stage);
      if (level === 2) for (let k = 0; k < 4; k++)
        add("structure", "rebar", x + (k % 2 ? .065 : -.065), y + 1.66,
          z + (k > 1 ? .065 : -.065), .035, .45, .035, "#4d4f4c", .72,
          { duration: .025, removeAt: .765 });
    }
    add("structure", "slab", 0, y + 1.49, 0, 4.5, .15, 4.2,
      level === 2 ? "#b7bbb5" : "#bec0b6", stage + .11);
    for (const x of [-1.8, 0, 1.8])
      add("structure", "beam", x, y + 1.38, 0, .23, .25, 3.6, "#a8aca5", stage + .07);
    for (const z of [-1.7, 0, 1.7])
      add("structure", "beam", 0, y + 1.38, z, 3.7, .25, .23, "#b6b7ad", stage + .07);
    for (let x = -1.9; x <= 2; x += .4) {
      add("structure", "guardrail", x, y + 1.62, 2.03, .08, .45, .08,
        "#e7b440", stage + .12, { removeAt: .9 });
      add("structure", "guardrail", x, y + 1.88, 2.03, .38, .045, .045,
        "#d79b31", stage + .12, { removeAt: .9 });
    }
  }
  for (let z = -2.2; z <= 2.3; z += .55) for (const x of [-2.45, 2.45]) {
    add("structure", "scaffold", x, 2.7, z, .048, 5.4, .048, "#798b90", .28, { removeAt: .91 });
    for (let y = .7; y < 5.2; y += 1.1) {
      const stage = .3 + y / 5.2 * .42;
      add("structure", "scaffold", x, y, z, .65, .08, .5, "#b8a782", stage, { removeAt: .91 });
      add("structure", "scaffold", x, y + .4, z + .23, .038, .86, .038,
        "#92a3a8", stage, { removeAt: .91, rx: .6 });
    }
  }
  for (let i = 0; i < 11; i++)
    add("structure", "stair", -1.1, .36 + i * .15, -.9 + i * .19,
      .72, .14, .2, "#a3a59e", .34 + i * .012);

  // Three thin, continuous slab-edge ribbons make the finished volume read
  // clearly from the overview. There is no new ground-level perimeter plinth:
  // the two original workers and loader keep their established clearances.
  for (let level = 0; level < 3; level++) {
    const y = 1.845 + level * 1.65;
    const stage = .811 + level * .007;
    for (const z of [-2.115, 2.115])
      wall(0, y, z, 4.54, .22, .17, stage, .841 + level * .008);
    for (const x of [-2.205, 2.205])
      wall(x, y, 0, .13, .22, 4.08, stage + .002, .843 + level * .008);
  }

  // The upper front is an uninterrupted curtain wall. Opaque, smooth blue
  // panes sit slightly ahead of a dark backer: their gaps become real mullions
  // while the whole facade still costs only two shared instance batches.
  for (let level = 1; level < 3; level++) {
    const floor = 1.915 + (level - 1) * 1.65;
    const y = floor + .74;
    permanent("facade", "window-frame", 0, y, 2.105, 4.22, 1.46, .12,
      COLOR.frame, .88 + level * .007, { duration: .014 });
    for (const x of [-2.19, 2.19])
      wall(x, y, 2.10, .18, 1.46, .22, .817 + level * .006, .846 + level * .008);
    for (let pane = 0; pane < 7; pane++) {
      const x = -1.785 + pane * .595;
      const stage = .882 + level * .008 + pane * .0013;
      permanent("glazing", "glass", x, y, 2.173, .545, 1.35, .025,
        COLOR.glass, stage, { duration: .012 });
      // Sparse lit panes, not a uniformly glowing block. Furniture silhouettes
      // are layered inside the dark frame and in front of the opaque blue plane.
      if ((level === 1 && [1, 2, 5].includes(pane)) || (level === 2 && [0, 3, 4].includes(pane))) {
        permanent("nightWindows", "lit-window", x, y, 2.192, .517, 1.31, .012,
          COLOR.light, .951 + level * .005 + pane * .0007, { duration: .012 });
      }
      if ([1, 3, 5].includes(pane)) {
        const at = .934 + level * .009 + pane * .001;
        permanent("details", "interior", x, floor + .53, 2.207, .40, .055, .012,
          COLOR.timber, at, { duration: .014 });
        for (const dx of [-.145, .145])
          permanent("details", "interior", x + dx, floor + .32, 2.207,
            .025, .37, .012, COLOR.frame, at, { duration: .014 });
        permanent("details", "interior", x + .025, floor + .665, 2.211,
          .19, .15, .014, COLOR.frame, at + .002, { duration: .014 });
        permanent("details", "interior", x + .025, floor + .575, 2.211,
          .03, .045, .014, COLOR.frame, at + .002, { duration: .014 });
      }
      if ((pane + level) % 4 === 0)
        permanent("details", "blind", x, floor + 1.25, 2.213, .50, .22, .018,
          COLOR.wall, .943 + level * .006, { duration: .014 });
    }
  }
  // One intentionally asymmetric gesture: four slender sun fins on the west
  // bay, against an otherwise quiet, horizontal building.
  for (let i = 0; i < 4; i++)
    permanent("facade", "sun-fin", -1.81 + i * .235, 3.495, 2.255,
      .047, 2.84, .18, COLOR.frame, .912 + i * .002, { duration: .014, ry: -.18 });

  // Ground floor: a left-hand studio window and a warm, recessed entrance on
  // the right. This is a doorway with depth, not a blue rectangle on a wall.
  wall(-2.11, 1.00, 2.055, .22, 1.47, .23, .816, .842);
  wall(-.095, 1.00, 2.055, .20, 1.47, .23, .817, .843);
  wall(1.745, 1.00, 1.995, .37, 1.47, .23, .818, .844);
  permanent("facade", "window-frame", -1.085, 1.005, 2.045, 1.82, 1.46, .12,
    COLOR.frame, .882, { duration: .014 });
  for (let pane = 0; pane < 4; pane++) {
    const x = -1.7475 + pane * .4425;
    permanent("glazing", "glass", x, 1.005, 2.113, .3975, 1.33, .025,
      COLOR.glass, .885 + pane * .002, { duration: .014 });
    if (pane === 1 || pane === 2)
      permanent("nightWindows", "lit-window", x, 1.005, 2.132, .374, 1.29, .012,
        COLOR.light, .953 + pane * .002, { duration: .012 });
  }
  permanent("facade", "entrance", .835, .99, 1.68, 1.53, 1.45, .13,
    COLOR.timber, .858);
  for (const x of [.065, 1.605])
    permanent("facade", "entrance", x, .995, 1.91, .12, 1.45, .56,
      COLOR.timber, .862);
  permanent("facade", "entrance", .835, 1.665, 1.935, 1.66, .15, .61,
    COLOR.timber, .866);
  permanent("facade", "window-frame", .835, .995, 1.773, 1.11, 1.36, .075,
    COLOR.frame, .901, { duration: .014 });
  for (const x of [.575, 1.095])
    permanent("glazing", "door-glass", x, .995, 1.821, .47, 1.25, .024,
      COLOR.glass, .906, { duration: .014 });
  for (const x of [.77, .90])
    permanent("details", "door-handle", x, .99, 1.866, .025, .28, .04,
      COLOR.wall, .936, { duration: .014 });
  permanent("facade", "canopy", .835, 1.755, 2.34, 2.19, .095, .98,
    COLOR.frame, .906, { duration: .015 });
  permanent("facade", "nameplate", .835, 1.649, 2.248, 1.17, .105, .018,
    COLOR.frame, .958, { duration: .014, id: "entry-nameplate" });
  permanent("details", "canopy-light", .835, 1.703, 2.53, 1.16, .008, .04,
    COLOR.light, .951, { duration: .014 });
  model.roofs.push({ x: .835, z: 2.34, w: 2.19, d: .98, y: 1.8025, stage: .921 });

  // Reception is a two-and-a-half-dimensional miniature behind the vitrine.
  // Its silhouettes remain visible without transparent glass or a full room.
  permanent("details", "reception", -1.075, .66, 2.151, 1.20, .43, .022,
    COLOR.timber, .938, { duration: .014 });
  permanent("details", "reception", -1.075, .895, 2.158, 1.25, .055, .028,
    COLOR.wall, .94, { duration: .014 });
  permanent("details", "interior", -1.045, 1.02, 2.165, .26, .20, .012,
    COLOR.frame, .943, { duration: .014 });
  permanent("details", "interior", -1.045, .907, 2.165, .045, .05, .012,
    COLOR.frame, .943, { duration: .014 });
  permanent("details", "interior", -1.63, .575, 2.164, .18, .23, .016,
    COLOR.concrete, .949, { duration: .014 });
  permanent("details", "interior", -1.63, .79, 2.166, .27, .29, .018,
    COLOR.plant, .951, { duration: .014 });

  // Side elevations use two punched window bands between solid wall piers.
  // The ground floor steps inward around the existing site crew and loader;
  // the two upper floors align with the original cantilevering concrete slabs.
  for (let level = 0; level < 3; level++) {
    const floor = level === 0 ? .24 : 1.915 + (level - 1) * 1.65;
    const height = 1.50;
    for (const side of [-1, 1]) {
      const x = side * (level === 0 ? (side < 0 ? 1.86 : 1.90) : 2.18);
      const stage = .814 + level * .008 + (side > 0 ? .002 : 0);
      const paint = .842 + level * .008 + (side > 0 ? .002 : 0);
      wall(x, floor + .205, 0, .14, .33, 4.10, stage, paint);
      wall(x, floor + height - .105, 0, .14, .21, 4.10, stage, paint);
      for (const [z, depth] of [[-1.785, .53], [0, .62], [1.785, .53]])
        wall(x, floor + .83, z, .14, .93, depth, stage, paint);
      for (const z of [-.91, .91]) {
        const at = .887 + level * .008 + (z > 0 ? .002 : 0);
        permanent("facade", "window-frame", x + side * .007, floor + .83, z,
          .16, .96, 1.23, COLOR.frame, at, { duration: .014 });
        permanent("glazing", "glass", x + side * .094, floor + .83, z,
          .025, .86, 1.12, COLOR.glass, at + .002, { duration: .014 });
        permanent("facade", "window-frame", x + side * .113, floor + .83, z,
          .02, .89, .037, COLOR.frame, at + .003, { duration: .014 });
        if ((side > 0 && z < 0 && level !== 1) || (side < 0 && z > 0 && level === 1))
          permanent("nightWindows", "lit-window", x + side * .113, floor + .83, z + .295,
            .012, .83, .51, COLOR.light, .956 + level * .003, { duration: .012 });
        if (level > 0 && z > 0)
          permanent("details", "blind", x + side * .124, floor + 1.12, z,
            .012, .20, 1.075, COLOR.wall, .943 + level * .006, { duration: .014 });
      }
    }
  }

  // The rear is quieter: masonry below a pair of wider horizontal windows.
  // Its ground wall stays north of the occupied rear supervisor position.
  for (let level = 0; level < 3; level++) {
    const floor = level === 0 ? .24 : 1.915 + (level - 1) * 1.65;
    const z = level === 0 ? -2.00 : -2.105;
    const stage = .82 + level * .007;
    const paint = .848 + level * .007;
    wall(0, floor + .30, z, 4.23, .52, .14, stage, paint);
    wall(0, floor + 1.385, z, 4.23, .23, .14, stage, paint);
    for (const x of [-1.805, 0, 1.805])
      wall(x, floor + .915, z, x === 0 ? .57 : .62, .72, .14, stage, paint);
    for (const x of [-.92, .92]) {
      const at = .891 + level * .007;
      permanent("facade", "window-frame", x, floor + .915, z - .005,
        1.28, .76, .16, COLOR.frame, at, { duration: .014 });
      permanent("glazing", "glass", x, floor + .915, z - .093,
        1.17, .66, .025, COLOR.glass, at + .002, { duration: .014 });
      permanent("facade", "window-frame", x, floor + .915, z - .113,
        .035, .70, .016, COLOR.frame, at + .003, { duration: .014 });
      if ((level + (x > 0 ? 1 : 0)) % 2 === 0)
        permanent("nightWindows", "lit-window", x + .30, floor + .915, z - .113,
          .53, .63, .012, COLOR.light, .957 + level * .003, { duration: .012 });
    }
  }

  // Topping-out reads as a finished roof: continuous parapets, proper coping,
  // a small stair enclosure and an equipment zone separated from the terrace.
  for (const z of [-2.055, 2.055]) {
    permanent("facade", "parapet", 0, 5.405, z, 4.47, .38, .16,
      COLOR.wall, .783);
    permanent("facade", "coping", 0, 5.611, z, 4.54, .055, .22,
      COLOR.concrete, .796, { duration: .014 });
  }
  for (const x of [-2.15, 2.15]) {
    permanent("facade", "parapet", x, 5.405, 0, .17, .38, 3.96,
      COLOR.wall, .785);
    permanent("facade", "coping", x, 5.611, 0, .23, .055, 4.04,
      COLOR.concrete, .798, { duration: .014 });
  }
  permanent("facade", "roof-core", -1.13, 5.70, -.86, 1.21, .97, 1.34,
    COLOR.wall, .799);
  permanent("facade", "roof-core", -1.13, 6.24, -.86, 1.34, .11, 1.46,
    COLOR.frame, .806, { duration: .014 });
  permanent("facade", "roof-door", -1.13, 5.635, -.181, .47, .82, .023,
    COLOR.frame, .906, { duration: .014 });
  permanent("glazing", "roof-door-glass", -1.13, 5.815, -.162, .36, .33, .015,
    COLOR.glass, .911, { duration: .012 });
  model.roofs.push({ x: -1.13, z: -.86, w: 1.34, d: 1.46, y: 6.295, stage: .82 });

  permanent("facade", "equipment-screen", .99, 5.535, -.86, 1.67, .62, 1.29,
    COLOR.frame, .934, { duration: .017 });
  permanent("details", "equipment", .99, 5.855, -.86, 1.51, .08, 1.13,
    COLOR.concrete, .938, { duration: .014 });
  for (let row = 0; row < 5; row++) {
    const y = 5.305 + row * .116;
    permanent("details", "equipment-grille", .99, y, -.198, 1.62, .045, .036,
      COLOR.concrete, .945 + row * .002, { duration: .012 });
    permanent("details", "equipment-grille", 1.842, y, -.86, .035, .045, 1.24,
      COLOR.concrete, .945 + row * .002, { duration: .012 });
  }
  model.roofs.push({ x: .99, z: -.86, w: 1.67, d: 1.29, y: 5.895, stage: .952 });
  permanent("facade", "terrace-deck", -.73, 5.242, .91, 2.42, .055, 1.62,
    COLOR.timber, .935, { duration: .017 });
  for (let i = 0; i < 5; i++)
    permanent("details", "deck-joint", -.73, 5.273, .245 + i * .325,
      2.37, .006, .012, COLOR.concrete, .945, { duration: .014 });
  permanent("details", "terrace-bench", -1.05, 5.495, 1.29, 1.35, .09, .35,
    COLOR.timber, .949, { duration: .014 });
  permanent("details", "terrace-bench", -1.05, 5.68, 1.463, 1.35, .32, .06,
    COLOR.timber, .949, { duration: .014 });
  for (const x of [-1.55, -.55])
    permanent("details", "terrace-bench", x, 5.36, 1.29, .08, .23, .32,
      COLOR.frame, .949, { duration: .014 });
  permanent("details", "terrace-table", .065, 5.545, .80, .48, .055, .48,
    COLOR.wall, .952, { duration: .014 });
  permanent("details", "terrace-table", .065, 5.395, .80, .10, .25, .10,
    COLOR.frame, .952, { duration: .014 });
  permanent("facade", "roof-planter", 1.47, 5.40, 1.00, .57, .34, 1.15,
    COLOR.concrete, .957, { duration: .015 });
  permanent("facade", "plant", 1.47, 5.62, 1.00, .47, .18, 1.05,
    COLOR.plant, .962, { duration: .015 });
  for (const [x, z, height] of [[1.37, .72, .32], [1.55, 1.11, .46], [1.38, 1.37, .30]])
    permanent("details", "plant", x, 5.68 + height / 2, z, .23, height, .24,
      COLOR.plant, .965, { duration: .014 });

  // The entry landing does not extend into the two existing front workers.
  // A shallow side-entry ramp runs east-west instead of pointing into traffic.
  permanent("facade", "entry-landing", .83, .16, 2.40, 1.71, .24, .64,
    COLOR.concrete, .946, { duration: .018 });
  permanent("facade", "entry-landing", .28, .16, 2.875, .34, .24, .49,
    COLOR.concrete, .946, { duration: .018 });
  permanent("facade", "ramp", -.90, .124, 2.875, 2.20, .055, .49,
    COLOR.concrete, .951, { duration: .018, rz: .10 });
  for (const z of [2.652, 3.098]) {
    permanent("details", "ramp-rail", -.90, .50, z, 2.20, .032, .032,
      COLOR.frame, .957, { duration: .014, rz: .10 });
    for (const x of [-1.85, -.90, .05]) {
      const rise = (x + .90) * Math.sin(.10);
      permanent("details", "ramp-rail", x, .32 + rise, z, .028, .36, .028,
        COLOR.frame, .957, { duration: .014 });
    }
  }
  permanent("facade", "planter", -1.63, .235, 2.345, .91, .39, .40,
    COLOR.concrete, .961, { duration: .015 });
  permanent("facade", "plant", -1.63, .485, 2.345, .80, .17, .31,
    COLOR.plant, .966, { duration: .014 });
  permanent("details", "plant", -1.87, .69, 2.345, .24, .29, .24,
    COLOR.plant, .972, { duration: .014 });
  permanent("details", "plant", -1.40, .62, 2.345, .31, .19, .25,
    COLOR.plant, .972, { duration: .014 });

  // A stable order keeps every permanent element at the front of this batch.
  // The renderer may trim the unused tail with mesh.count after temporary
  // rebar, rails and scaffolding have gone, instead of drawing 294 tiny cubes.
  model.structure.sort((a, b) =>
    (a.removeAt >= 2 ? -1 : a.removeAt) - (b.removeAt >= 2 ? -1 : b.removeAt));
  return model;
}
