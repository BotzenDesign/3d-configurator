Here are all the raw formulae, nothing else.

---

## Shared — Mesh Slicing

```
t = d_a / (d_a - d_b)
P = V_a + t × (V_b - V_a)

A = 0.5 × Σ (x_i × y_{i+1} − x_{i+1} × y_i)
A > 0 → CCW (outer)
A < 0 → CW (hole)
```

---

## FDM

```
layer_height = 0.5 × nozzle_diameter          (recommended)
layer_height_min = 0.25 × nozzle_diameter
layer_height_max = 0.75 × nozzle_diameter

line_width = nozzle_diameter × line_width_multiplier

filament_area = π × (filament_diameter / 2)²
E = (line_width × layer_height × travel_distance) / filament_area

inset_0 = line_width / 2
inset_n = inset_0 + (n × line_width)

line_spacing = line_width / (infill_density / 100)
infill_boundary = perimeter_inset − (line_width × infill_overlap%)

support_angle = arccos(|n̂ · ẑ|) × (180/π)
support_line_spacing = support_line_width / (support_density / 100)

E_retract = −retract_distance
E_unretract = +retract_distance + extra_prime

E_compensated = E_nominal + K × (dE/dt)
```

---

## SLA

```
Cd = Dp × ln(E_max / E_c)

E_max = (P × t) / A

Cd = Dp × ln((P × t) / (A × E_c))

bottom_exposure = normal_exposure × multiplier     (multiplier = 3–8×)

coverage = polygon_area_in_pixel / pixel_area      (clamp to [0, 1])
gray_value = round(coverage × 255)

x_mm = pixel_x × xy_resolution − (build_width / 2)
y_mm = pixel_y × xy_resolution − (build_height / 2)

xy_resolution = build_plate_width / horizontal_pixel_count

tip_radius = 0.05–0.3 mm
tan(α) = (base_radius − tip_radius) / height

support_count = ceil(island_area / support_spacing²)
```