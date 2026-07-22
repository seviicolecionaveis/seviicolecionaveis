
CREATE TABLE public.illustrators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.illustrators TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.illustrators TO authenticated;
GRANT ALL ON public.illustrators TO service_role;

ALTER TABLE public.illustrators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view illustrators" ON public.illustrators
  FOR SELECT USING (true);
CREATE POLICY "Admins insert illustrators" ON public.illustrators
  FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update illustrators" ON public.illustrators
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete illustrators" ON public.illustrators
  FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.cards
  ADD COLUMN illustrator_id uuid REFERENCES public.illustrators(id) ON DELETE SET NULL;

CREATE INDEX idx_cards_illustrator_id ON public.cards(illustrator_id) WHERE illustrator_id IS NOT NULL;

INSERT INTO public.illustrators (name) VALUES
('Ken Sugimori'),('Mitsuhiro Arita'),('Keiji Kinebuchi'),('Tomoaki Imakuni'),('Kagemaru Himeno'),
('Miki Tanaka'),('Shin-ichi Yoshida'),('Takumi Akabane'),('Sumiyoshi Kizuki'),('Atsuko Nishida'),
('Benimaru Itoh'),('Hikaru Koike'),('Hironobu Yoshida'),('Milky Isobe'),('Naoyo Kimura'),
('Tomokazu Komiya'),('K. Hoshiba'),('CR CG gangs'),('Shin-ichi Yoshikawa'),('Katsura Tabata'),
('"Big Mama" Tagawa'),('Ryuta Kusumi'),('Yousuke Hirata'),('Hiromichi Sugiyama'),('Hideki Kazama'),
('Aya Kusube'),('Kimiya Masago'),('Yuka Morii'),('Yukiko Baba'),('Keiko Fukuyama'),
('Kyoko Umemoto'),('Hajime Kusajima'),('Masako Yamashita'),('Toshinao Aoki'),('Keita Komatsuya'),
('Jungo Suzuki'),('Etsuya Hattori'),('Christopher Rush'),('Hiroaki Ito'),('Yuichi Sawayama'),
('Asuka Iwashita'),('Sachi Matoba'),('Motofumi Fujiwara'),('Satoshi Ohta'),('Aimi Tomita'),
('Hideyuki Nakajima'),('Kai Ishikawa'),('Kouki Saitou'),('Hisao Nakamura'),('Midori Harada'),
('Hizuki Misono'),('Mikio Menjo'),('Kazuo Yazawa'),('Ken Ikuji'),('Kunihiko Yuyama'),
('Craig Turvey'),('Ryo Ueda'),('Zu-Ka'),('K. Utsunomiya'),('Nakaoka'),
('T. Honda'),('Mt. TBT'),('M. Akiyama'),('Atsuko Ujiie'),('Yosuke Da Silva'),
('Kyoko Koizumi'),('Mark Kraus'),('Katie Gross'),('May Do'),('Rowan Laidlaw'),
('Sylvia Forrest'),('Masakazu Fukuda'),('Emi Miwa'),('Sachiko Adachi'),('Tomoko Wakai'),
('Takao Unno'),('Kenkichi Toyama'),('Hiroki Fuchino'),('Kanako Eo'),('Suwama Chiaki'),
('Shizurow'),('Takabon'),('Yasuki Watanabe'),('Masahiko Ishii'),('Yusuke Shimada'),
('Mikiko Takeda'),('Daisuke Ito'),('Kazuyuki Kano'),('Emi Yoshida'),('Yusuke Ohmura'),
('Lee HyunJung'),('Kent Kanetsuna'),('Saya Tsuruta'),('Kazuaki Aihara'),('Yusuke Ishikawa'),
('Makoto Imai'),('Ryota Saito'),('kawayoo'),('Shin Nagasawa'),('Wataru Kawahara'),
('TOKIYA'),('Keiko Moritsugu'),('Mana Ibe'),('Nobuyuki Fujimoto'),('Reiko Tanoue'),
('sui'),('Pokémon Rumble'),('Naoki Saito'),('match'),('MAHOU'),
('Hideaki Hakozaki'),('Takashi Yamaguchi'),('Noriko Hotta'),('Shinji Higuchi'),('Sachiko Eba'),
('Noriko Takaya'),('Ayaka Yoshida'),('Shigenori Negishi'),('Daisuke Iwamoto'),('Mizue'),
('Akira Komayama'),('Yuri Umemura'),('5ban Graphics'),('Megumi Mizutani'),('James Turner'),
('Maiko Fujiwara'),('Tomohiro Kitakaze'),('Eske Yoshinob'),('HiRON'),('BERUBURI'),
('Toyste Beach'),('hatachu'),('Satoshi Shirai'),('Hiroki Asanuma'),('Kouji Tajima'),
('kirisAki'),('Sanosuke Sakuma'),('Hitoshi Ariga'),('The Pokémon Company Art Team'),('PLANETA'),
('Ryota Murayama'),('Emi Ando'),('nagimiso'),('GAME FREAK inc.'),('You Iribi'),
('Yoshinobu Saito'),('Kouichi Ooyama'),('miki kudo'),('DemizuPosuka'),('Hideki Ishikawa'),
('kodama'),('Mina Nakai'),('Hasuno'),('Shibuzoh.'),('Eri Yamaki'),
('kanahei'),('Yumi'),('Anesaki Dynamic'),('chibi'),('Gosha'),
('Gabi'),('Peegeray'),('Mireil'),('Xime'),('Ashley'),
('Me!'),('Rhivern'),('Meli'),('Asako Ito'),('Hiroyuki Yamamoto'),
('0313'),('so-taro'),('Sekio'),('tetsuya koizumi'),('SATOSHI NAKAI'),
('take'),('Misa Tsutsui'),('Studio Bora Inc.'),('otumami'),('sowsow'),
('PLANETA Otani'),('PLANETA Igarashi'),('HYOGONOSUKE'),('MPC Film'),('Framestore'),
('sadaji'),('aky CG Works'),('AKIRA EGAWA'),('KEIICHIRO ITO'),('PLANETA Tsuji'),
('ryoma uratsuka'),('ConceptLab'),('Uta'),('Pani Kobayashi'),('Ryuta Fuse'),
('inose yukie'),('Sakiko Maeda'),('Junsei Kuninobu'),('Noriko Uono'),('Nabana Kensaku'),
('Tomomi Kaneko'),('Misaki Hashimoto'),('Fumie Kittaka'),('Huang Tzu En'),('Avec Yoko'),
('2017 Pikachu Project'),('2019 Pikachu Project'),('Q-rais'),('NC Empire'),('Mike Cressy'),
('Taira Akitsu'),('Megumi Higuchi'),('Kazuma Koda'),('Jumpei Akasaka'),('Hasegawa Saki'),
('Saki Hayashiro'),('PLANETA Mochizuki'),('Tika Matsuno'),('Souichirou Gunjima'),('Yuu Nishida'),
('Narumi Sato'),('Kinu Nishimura'),('KIYOTAKA OSHIYAMA'),('Mika Pikazo'),('Atsushi Furusawa'),
('D.A.G Inc.'),('OKACHEKE'),('Teeziro'),('Oswaldo KATO'),('Nagomi Nijo'),
('AYUMI ODASHIMA'),('En Morikura'),('MUGENUP'),('Yuya Oka')
ON CONFLICT (name) DO NOTHING;
