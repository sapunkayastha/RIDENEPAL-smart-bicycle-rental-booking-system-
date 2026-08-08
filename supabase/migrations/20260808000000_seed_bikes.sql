-- Seed the bikes catalog. Safe to re-run: skips if bikes already exist.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.bikes) THEN
    INSERT INTO public.bikes (name, type, price_per_day, image_url, description, available, specs) VALUES
    (
      'Himalayan Explorer 500',
      'electric',
      1200.00,
      NULL,
      'Our flagship expedition e-bike, built for long climbs and rough Himalayan trails. 750W peak motor, 85km average range, and a reinforced frame rated for cargo panniers.',
      true,
      '{"motor_power": "750W Peak", "range_km": 85, "weight_kg": 24, "battery": "48V 14Ah Removable", "gears": 9, "brakes": "Hydraulic Disc", "terrain": "Off-road / Mountain"}'::jsonb
    ),
    (
      'Kathmandu City Cruiser',
      'electric',
      700.00,
      NULL,
      'Light, nimble, and built for weaving through city traffic. Perfect for day trips around the valley — Patan, Bhaktapur, and back with charge to spare.',
      true,
      '{"motor_power": "350W", "range_km": 50, "weight_kg": 18, "battery": "36V 10Ah Removable", "gears": 7, "brakes": "Mechanical Disc", "terrain": "City / Paved"}'::jsonb
    ),
    (
      'Pokhara Trail Hybrid',
      'hybrid',
      450.00,
      NULL,
      'A dependable pedal-assist hybrid for lakeside rides and gentle hill trails around Pokhara. Comfortable upright riding position, wide tires for mixed terrain.',
      true,
      '{"motor_power": "250W", "range_km": 40, "weight_kg": 16, "battery": "36V 8Ah Removable", "gears": 8, "brakes": "V-Brake", "terrain": "Mixed / Trail"}'::jsonb
    ),
    (
      'Everest Basecamp Fatbike',
      'electric',
      1600.00,
      NULL,
      'Oversized tires and a high-torque motor for serious off-road expeditions — river crossings, gravel, and steep switchbacks near the high trails.',
      true,
      '{"motor_power": "1000W Peak", "range_km": 70, "weight_kg": 27, "battery": "48V 17.5Ah Removable", "gears": 11, "brakes": "Hydraulic Disc", "terrain": "Extreme Off-road"}'::jsonb
    ),
    (
      'Thamel Classic Single-Speed',
      'manual',
      250.00,
      NULL,
      'A simple, sturdy single-speed for short trips around town. No battery to charge, nothing to break — just get on and ride.',
      true,
      '{"motor_power": "None (manual)", "range_km": null, "weight_kg": 12, "battery": "None", "gears": 1, "brakes": "Coaster Brake", "terrain": "City / Paved"}'::jsonb
    ),
    (
      'Annapurna Adventure Tourer',
      'hybrid',
      850.00,
      NULL,
      'Built for multi-day touring — rack-ready frame, wide gear range for long climbs, and a saddle designed for comfort over long distances.',
      true,
      '{"motor_power": "300W", "range_km": 55, "weight_kg": 19, "battery": "36V 11Ah Removable", "gears": 21, "brakes": "Mechanical Disc", "terrain": "Touring / Mixed"}'::jsonb
    );
  END IF;
END $$;
