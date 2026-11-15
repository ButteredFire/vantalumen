# Kế hoạch nâng cấp asset và mô phỏng di chuyển trên Sao Hỏa – Mặt Trăng

Ngày lập: 15/11/2026, Asia/Bangkok. Trạng thái: kế hoạch triển khai; các tính năng dưới đây chưa được thực hiện.

Phạm vi đã thống nhất: hình ảnh hướng tới chân thực, góc nhìn thứ nhất có di chuyển, địa hình rộng có rãnh/hố/chướng ngại vật, trạm vũ trụ chuyển động theo quỹ đạo. Hỗ trợ cả máy tính và điện thoại, tự điều chỉnh chất lượng theo khả năng thiết bị và hiệu năng thực tế.

## 1. Kết quả cần đạt

- Lựa chọn 1 tiếp tục cho phép xem và kiểm tra mô hình. Lựa chọn 2 đưa người dùng vào camera gắn trên thiết bị để khám phá môi trường.
- Rover có tiến/lùi, đánh lái, phanh, bánh quay, khớp treo chuyển động và thân xe nghiêng theo tiếp xúc địa hình. Hố/rãnh/đá ảnh hưởng đến hành trình.
- Thiết bị bay có chuyển động và va chạm phù hợp. Trạm và tàu quỹ đạo có camera đi cùng quỹ đạo quanh thiên thể.
- Mỗi thiên thể có vùng khám phá mục tiêu 64 × 64 km, tương đương 4.096 km². Đây là diện tích vùng chơi, không phải tuyên bố đã tái dựng toàn bộ hành tinh ở độ chi tiết sát mặt đất.
- Bắt đầu với khu kiểm chứng 2 × 2 km cho mỗi thiên thể, mở rộng lên 16 × 16 km rồi 64 × 64 km sau khi đạt các mốc chất lượng.
- Các mức đồ họa dùng cùng địa hình va chạm, chướng ngại vật và quy tắc chuyển động. Điện thoại giảm chi tiết hình ảnh, khoảng nhìn và hiệu ứng.

## 2. Hiện trạng đã kiểm tra trong workspace

Đường dẫn dự án thực tế: D:/vantalumen-main/vantalumen-main. Đánh giá dựa trên mã và asset hiện có; không dùng trạng thái hoàn thành trong tài liệu cũ làm bằng chứng.

| Phát hiện | Vị trí | Tác động đến kế hoạch |
| --- | --- | --- |
| POV dựng thân xe bằng box/cylinder trong OnboardHardwareFrame | src/scene/spacecraft/ControlRoomFirstPersonScene.tsx | Thay phần nhìn thấy bằng mô hình đúng thiết bị, có vật liệu và điểm gắn camera |
| Camera POV bị đặt lại tại (0, eyeY, 0); chỉ có yaw/pitch/zoom | src/core/camera/SplineCameraRig.tsx | Tách quyền điều khiển camera; camera mô phỏng phải bám pose của thiết bị |
| Terrain POV rộng 28 scene units, chiều sâu khoảng 14; lấy độ cao tại tâm | ControlRoomFirstPersonScene.tsx; src/scene/surface/MarsTerrainPatch.tsx | Chưa có bản đồ lái và truy vấn tiếp xúc bánh liên tục; scene units hiện chưa được kiểm chứng là mét |
| Mars terrain có 20.402 tam giác; Moon terrain có 7.442 tam giác | public/assets/models/mars/mars_terrain.glb; models/moons/moon_terrain.glb | Mật độ hình học hiện tại không đáp ứng một vùng lái lớn có chướng ngại ở cấp bánh xe |
| Albedo/normal nguồn là 8192 × 4096 nhưng loader thu xuống 2048 × 1024; roughness xuống 1024 × 512 | src/core/loaders/useProgressiveAsset.ts | Cần chọn asset theo quality tier và chia tile, thay cho mức thu nhỏ cố định |
| PlanetaryTerrainMesh tải normal texture nhưng chưa gán vào normalMap | src/scene/surface/PlanetaryTerrainMesh.tsx | Cần thống nhất vật liệu giữa bản đồ bề mặt và POV |
| Model xem gần được chuẩn hóa cạnh dài nhất về 2 units; schema yêu cầu physicalScaleVerified=false | src/scene/spacecraft/DeviceModel.tsx; src/types/cosmos.types.ts; src/config/validateCatalog.ts | Bổ sung transform theo mét cho mô phỏng, giữ transform chuẩn hóa riêng cho chế độ xem mô hình |
| Curiosity và Spirit/Opportunity mỗi GLB chỉ có một mesh/node; Perseverance có nhiều node; cả các rover đã kiểm tra chưa có animation clip | Các GLB rover hiện có | Cần audit/tách bánh và tạo pivot; không thể coi mọi model là đã có rig sử dụng được |
| Sáu hồ sơ Apollo bề mặt dùng procedural model; chưa có GLB bề mặt trong manifest | src/config/deviceManifest.json | Cần công việc dựng/retopology/rig riêng cho LRV và thiết bị Apollo |
| Chưa có physics engine trong dependencies; FloatingOriginManager chưa thực hiện dịch gốc tọa độ | package.json; src/core/canvas/FloatingOriginManager.tsx | Phải bổ sung nền tảng va chạm, bước thời gian cố định và dịch gốc đồng bộ |
| POV quỹ đạo hiện hiển thị quả cầu đơn giản; đồng hồ mô phỏng được tăng trong camera rig chỉ ở ORBITAL_OVERVIEW | ControlRoomFirstPersonScene.tsx; SplineCameraRig.tsx | Tách clock khỏi camera và dùng pose quỹ đạo chung cho overview/POV |
| Có hai đường render bề mặt/POV với Canvas và loader khác nhau | src/core/canvas/MarsCanvas.tsx; src/scene/surface/SurfaceTerrainView.tsx | Dùng chung provider địa hình, chất lượng và tài nguyên; chỉ scene đang hoạt động được chạy frame loop |

Kiểm tra nền đã chạy: npm run typecheck đạt; npm test đạt 18/22, còn 4 ca thất bại liên quan chuyển thiên thể/chuyển chế độ/reset POV. Cần phân biệt lỗi ứng dụng và kỳ vọng test cũ trước khi sửa. Playwright đang cấu hình tests/browser nhưng thư mục này không có trong workspace; chưa có kết quả kiểm thử trình duyệt hay benchmark GPU cho kế hoạch này.

## 3. Hành vi theo loại thiết bị

| Nhóm | Chuyển động | Góc nhìn thứ nhất |
| --- | --- | --- |
| Sojourner, Spirit/Opportunity, Curiosity, Perseverance | Lái rover 6 bánh; giới hạn theo profile từng xe | Camera trên thân/mast đúng thiết bị, nhìn độc lập với hướng lái |
| Apollo LRV | Lái xe 4 bánh, có đánh lái và hệ treo riêng | Vị trí người lái, bảng điều khiển và phần thân xe phù hợp |
| Ingenuity | Cất/hạ cánh, bay ngang, lên/xuống, va chạm với mặt đất/đá | Camera gắn trên thiết bị; hoạt động trong môi trường Sao Hỏa |
| Viking, InSight, thiết bị Apollo cố định | Chế độ khám phá cho phép di chuyển giả lập có va chạm và bám địa hình; chế độ theo thiết bị giữ vị trí triển khai | Camera gắn trên thiết bị; hiển thị rõ “Di chuyển giả lập” khi dùng khả năng bổ sung |
| Trạm vũ trụ và tàu quỹ đạo | Di chuyển theo quỹ đạo; dừng/tiếp tục và tua thời gian | Camera đi cùng trạm/tàu, có hướng nhìn ra cửa sổ hoặc cảm biến tương ứng |

Đề xuất mặc định cho thiết bị cố định trong trải nghiệm khám phá là di chuyển giả lập để đáp ứng yêu cầu khám phá bằng mọi thiết bị bề mặt. Không bổ sung bánh xe giả vào model lịch sử. Trạng thái này phải phân biệt được với khả năng thực của thiết bị. Tàu quỹ đạo như MRO/LRO dùng điều khiển quỹ đạo cùng nhóm với trạm; các tàu tham chiếu không thuộc sứ mệnh tại thiên thể phải có nhãn bối cảnh phù hợp.

Thiết kế cấu hình tập trung DeviceSimulationProfile với mobilityKind, bodyId, kích thước/mass/giới hạn chuyển động, cameraMounts, wheelRig, collisionShape và nguồn thông số. Loại chuyển động được đọc từ cấu hình, thay cho nhiều danh sách ID trong camera và scene.

Điều khiển máy tính: W/S tiến–lùi, A/D lái, Space phanh, kéo chuột nhìn, C đổi camera, R phục hồi về điểm an toàn. Thiết bị bay có nút lên/xuống riêng. Pointer lock là tùy chọn do người dùng bật.

Điện thoại: joystick lái bên trái, vùng kéo để nhìn bên phải, nút phanh/phục hồi và nút cao độ khi bay; hỗ trợ hai ngón tay đồng thời, không để thao tác HUD kéo camera. Thu gọn hai panel bên thành ngăn mở được để chừa vùng quan sát. Buông toàn bộ input khi mất focus, pointercancel, đổi thiết bị hoặc đổi thiên thể.

HUD hiển thị tốc độ, quãng đường, độ nghiêng, trạng thái tiếp xúc/độ bám, cảnh báo lật/kẹt và bản đồ nhỏ có vệt hành trình. Có tốc độ theo profile thiết bị và chế độ khám phá nhanh hơn được ghi nhãn; giới hạn tốc độ vẫn phải phù hợp khả năng va chạm và tải địa hình.

## 4. Kiến trúc bản đồ lớn

Luồng dữ liệu: Input → bộ điều khiển thiết bị → bước vật lý → pose thân/bánh/camera → render và telemetry. TerrainProvider cấp cùng dữ liệu hình dạng cho hiển thị, va chạm và truy vấn độ dốc. Đồng hồ quỹ đạo hoạt động độc lập với camera và vật lý bề mặt.

### Tọa độ và kích thước

- Vật lý bề mặt dùng 1 unit = 1 mét. Globe hiện dùng kilomet có lớp chuyển đổi rõ ràng; không đưa trực tiếp tọa độ globe vào physics.
- Lưu vị trí toàn cục theo tọa độ gắn với thiên thể bằng số double; mỗi vùng hoạt động có hệ tọa độ địa phương. Lưu cả thiên thể, vùng, phiên bản terrain và tọa độ trong checkpoint.
- Floating origin dịch đồng thời camera, thân xe, collider địa hình, đá, vệt bánh và các đối tượng liên quan tại ranh giới bước vật lý. Ngưỡng thử ban đầu khoảng 1 km; kiểm tra lại bằng benchmark.
- Mỗi tile có quy chiếu địa lý và mốc độ cao. Vùng 64 km cần giữ độ cong bề mặt; không dùng phép trải phẳng toàn cầu hiện có để tính quãng đường hay trọng lực cục bộ.
- Dùng quy ước cao độ đồng nhất khi trộn DEM; chỉ phóng đại độ cao trong chế độ trình diễn được ghi rõ. Chế độ lái dùng hình dạng và scale đã cấu hình.

### Chia vùng và tải theo vị trí

- Tile cơ sở đề xuất 256 × 256 m, có các cấp LOD. Chỉ tải những tile quanh xe và theo hướng chuyển động; cảnh xa dùng tile thô hơn.
- Vùng rất gần bánh xe có chi tiết hình học/collider nhỏ hơn, lựa chọn theo bánh nhỏ nhất và bài kiểm thử vượt rãnh. Đá/chướng ngại có ảnh hưởng hành trình dùng collider riêng.
- Nội suy chuyển LOD và ghép mép để tránh khe hở. Collider lấy từ dữ liệu địa hình chuẩn, độc lập việc hình ảnh đang dùng LOD nào.
- Giữ tile va chạm cũ đến khi tile mới đã sẵn sàng. Ưu tiên tải vùng spawn trước khi bật lái. Nếu mạng chậm, phanh tại vùng dữ liệu an toàn và báo đang tải; không cho xe rơi qua tile chưa có collider.
- Dùng worker cho giải mã/sinh terrain, hàng đợi ưu tiên, hủy tải khi đổi thiên thể và cache có giới hạn. Refcount ngăn dispose texture/geometry còn đang được scene khác sử dụng.
- Bán kính va chạm khởi điểm 64–128 m quanh thiết bị, mở rộng theo tốc độ và thời gian phanh. Không tạo collider cho toàn bộ 4.096 km² cùng lúc.
- Mép vùng 64 × 64 km có thông báo giới hạn và lựa chọn vùng kế tiếp; đường chân trời dùng địa hình nền. Lưu trạng thái khi rời và quay lại vùng.

### Dữ liệu địa hình và mức độ chân thực

Sao Hỏa: dùng MOLA làm nền quy mô lớn, ghép DEM/ảnh trực giao HiRISE tại khu vực có dữ liệu. MOLA 463 m là dữ liệu địa hình nền; HiRISE mô tả DTM thường có khoảng cách mẫu 1–2 m, vẫn chưa đủ để đo các rãnh cỡ bánh xe nhỏ. Vì vậy cần lớp đá/rãnh/chi tiết gần được tái dựng có seed ổn định và ghi nguồn riêng. Nguồn: [USGS MOLA](https://astrogeology.usgs.gov/search/map/mars_mgs_mola_dem_463m), [HiRISE DTM](https://hirise.lpl.arizona.edu/dtm/about.php).

Mặt Trăng: khảo sát LOLA/Kaguya cho nền vùng và LROC NAC DTM tại điểm khám phá. Bộ LOLA/Kaguya 59 m được liệt kê cho dải 60°N–60°S, không mặc định coi là dữ liệu phủ hai cực. Apollo 15 là ứng viên có DTM vùng lân cận 5 m/pixel; chi tiết cấp bánh xe vẫn cần lớp tái dựng. Nguồn: [USGS LOLA/Kaguya](https://astrogeology.usgs.gov/search/map/moon_lro_lola_selene_kaguya_tc_dem_merge_60n60s_59m), [LROC Apollo 15](https://data.lroc.im-ldi.com/lroc/view_rdr/NAC_DTM_APOLLO15_2).

Pipeline dự kiến: tải dữ liệu nguồn ngoài runtime → kiểm tra CRS/kinh độ/datum/nodata → chuyển đổi bằng GDAL → cắt tile heightfield/ảnh → tạo LOD, collider và texture nén → xuất manifest có bounds, độ phân giải, nguồn, license, checksum. Định dạng độ cao lưu scale/offset và sai số lượng tử hóa để tránh mất các chi tiết nhỏ.

Vùng đầu tiên đề xuất là Ares Vallis cho Sojourner và khu Apollo 15 cho LRV. Việc chọn footprint cuối cùng phụ thuộc audit coverage. Nơi chưa có DEM chi tiết vẫn có thể khám phá bằng nền địa hình kết hợp tái dựng; ghi rõ phần đo đạc/phần tái dựng. Chưa tải hay tích hợp các dataset trên, và chưa xác nhận nguồn chi tiết phủ trọn các vùng 64 × 64 km.

## 5. Vật lý và camera

Đề xuất thử Rapier trong bản kiểm chứng đầu tiên, chọn bản tương thích với React 19/R3F 9 hiện có rồi khóa phiên bản. Rapier cung cấp heightfield/trimesh colliders, truy vấn hình học và bộ điều khiển xe raycast; cơ cấu 6 bánh rocker-bogie cần phần giải riêng theo thiết bị. Nguồn: [Rapier colliders](https://rapier.rs/docs/user_guides/javascript/colliders/), [Rapier controllers](https://rapier.rs/docs/user_guides/javascript/character_controller/).

- Physics chạy fixed timestep 60 Hz, render nội suy pose. Có giới hạn bước bù khi frame chậm; tạm dừng khi tab ẩn và không bù một khoảng thời gian dài khi quay lại.
- Rover dùng thân có khối lượng/quán tính, tiếp xúc từng bánh, lực kéo/phanh/ma sát và giải hình học rocker-bogie. Kiểm chứng ray/shape cast trên mép đá và rãnh để tránh bánh xuyên hoặc bật nảy bất thường.
- Profile tách riêng 6 bánh rover và 4 bánh LRV; kiểm chứng kích thước bánh, trục quay, điểm nối, góc lái, khoảng sáng gầm và giới hạn dốc trước khi gắn nhãn thông số thật.
- Trọng lực, độ bám và môi trường được cấu hình theo thiên thể; độ bám đất và lún ở bản đầu là mô hình gần đúng cho trải nghiệm, không phải mô phỏng địa kỹ thuật đã được kiểm định.
- Rãnh nhỏ trong giới hạn được vượt qua; hố sâu/đá lớn có thể gây mắc gầm, trượt hoặc lật. Người dùng cần giảm tốc/chọn đường khác/phục hồi; không cho xe tự đi xuyên chướng ngại.
- Dùng collider đơn giản cho chassis/đá; heightfield cho phần mặt đất một lớp, mesh tĩnh cục bộ cho vách/hốc cần hình học phức tạp. Bật biện pháp chống xuyên theo tốc độ ở những đối tượng cần thiết.
- Camera gắn vào mount của model, chịu pitch/roll của thân và góc nhìn người dùng. Có tùy chọn ổn định đường chân trời/giảm rung và góc nhìn ngoài để xử lý tình huống mắc kẹt.
- Lưu điểm phục hồi chỉ khi thiết bị ổn định và tile có collider. Phục hồi xóa vận tốc/input cũ, đặt đúng cao độ và giữ nguyên vùng/thiên thể.

Đối với quỹ đạo: chuyển đồng hồ ra SimulationClock; overview và POV dùng cùng orbital pose. Kiểm tra công thức quay hệ tọa độ và giải Kepler của computeOrbitalPosition, bổ sung kiểm thử chu kỳ/cận điểm/viễn điểm trước khi dùng cho camera. Tách kích thước hiển thị phóng đại khỏi vị trí/độ cao quỹ đạo. Camera cabin dùng tọa độ gần và render hành tinh ở tỉ lệ phù hợp để tránh lỗi depth; thay đổi time warp không được tăng tốc vật lý rover.

## 6. Nâng cấp asset và ánh sáng

1. Audit từng asset: nguồn/license, tỉ lệ, orientation, UV, texture, số tam giác/material, node bánh/khớp, camera mount. Ưu tiên Sojourner và một LRV để tạo chuẩn hình ảnh; sau đó áp dụng cho toàn bộ danh mục có POV.
2. Dùng model nguồn phù hợp, retopology khi cần, tách bánh và tạo pivot/rig. Nguồn khảo sát bổ sung: [NASA 3D Resources](https://science.nasa.gov/3d-resources/); kiểm tra từng asset cụ thể trước khi nhập. Giữ credit và version trong manifest.
3. Làm vật liệu PBR với base color, normal, roughness, metallic và AO phù hợp từng phần: lớp cách nhiệt, tấm pin, dây cáp, bánh xe, bề mặt bám bụi. Loại bóng/ánh sáng đã bake vào albedo khi cần để ánh sáng động không bị chồng sai.
4. Model dùng chung giữa kiểm tra và mô phỏng nhưng có transform riêng. POV phải nhìn thấy chi tiết thật của thiết bị ở tỉ lệ hợp lý. Model Apollo chưa có cần công việc dựng 3D; tăng texture hoặc tăng subdivision không tự tạo ra các chi tiết thiết bị còn thiếu.
5. Tạo ít nhất ba LOD và texture tier cho thiết bị/đá. Thử khởi điểm hero rover khoảng 30–60 nghìn tam giác trên mobile, 100–200 nghìn trên desktop; mức cuối dựa vào hình ảnh và GPU cost, không chỉ số polygon.
6. Chuyển texture runtime sang KTX2/Basis, tạo mipmap và kiểm tra normal-map artifacts; có texture fallback nhỏ. KTX2Loader chuyển sang định dạng texture nén phù hợp GPU. Nguồn: [Three.js KTX2Loader](https://threejs.org/docs/pages/KTX2Loader.html).
7. Bề mặt có lớp màu ở quy mô vùng, vật liệu đất/đá lặp ở thang mét, normal chi tiết khi nhìn gần, đá rải bằng instancing và vệt bánh có giới hạn dung lượng. Các chi tiết tác động va chạm phải có trong hình học/collider, không chỉ vẽ bằng normal map.
8. Ánh sáng riêng theo môi trường: Mặt Trời, bóng tiếp xúc và exposure hợp lý; khí bụi mỏng trên Sao Hỏa; nền trời tối và ánh sáng/bụi phù hợp môi trường Mặt Trăng. Giảm bloom/vignette để giữ chi tiết. Áp dụng cùng color management cho POV và bản đồ.

## 7. Chất lượng tự thích nghi

Các giá trị dưới đây là ngân sách khởi điểm cho benchmark, chưa phải kết quả đo hay cam kết trên mọi thiết bị.

| Hạng mục | Điện thoại / Low | Máy phổ thông / Medium | Máy mạnh / High |
| --- | --- | --- | --- |
| Mục tiêu khung hình | 30 FPS ổn định | 45–60 FPS | 60 FPS |
| DPR hiệu dụng ban đầu | 0,75–1 | 1–1,25 | 1–1,5 |
| Texture riêng đang dùng | 1K–2K | Chủ yếu 2K | 2K–4K cho vùng/model gần |
| Bóng/hiệu ứng | Vùng bóng nhỏ, giảm hậu kỳ và hạt bụi | Bóng vừa, AO tùy hiệu năng | Bóng chi tiết, AO và chi tiết gần cao hơn |
| Ngân sách draw calls ban đầu | ≤150 | ≤250 | ≤400 |
| Ngân sách tài nguyên GPU ước tính | ≤256 MiB | ≤512 MiB | ≤1 GiB |

Auto quality dựa trên khả năng WebGL/texture format và thời gian frame đã đo, không chỉ user-agent. Hạ DPR/hậu kỳ trước, rồi giảm chi tiết xa và mức texture. Có khoảng chờ khác nhau khi tăng/giảm chất lượng để tránh thay đổi liên tục. Giữ tùy chọn Auto/Low/Medium/High và nút giảm hiệu ứng chuyển động.

Giới hạn texture được quyết định trước khi tải: điện thoại tải bản nhỏ trực tiếp thay vì tải ảnh 8K rồi resize. Theo dõi riêng byte tải, JS heap, số geometry/texture và ước tính bộ nhớ GPU; không coi renderer.info.memory là phép đo VRAM đầy đủ. Kiểm tra nhiệt và hiệu năng sau ít nhất 15 phút trên thiết bị thật, bao gồm Safari iOS và Chrome Android đại diện.

## 8. Thứ tự triển khai và điều kiện chuyển bước

| Mốc | Công việc / đầu ra | Điều kiện nghiệm thu |
| --- | --- | --- |
| M0 — Chuẩn hóa nền | Xử lý 4 test đang lỗi; schema profile, đơn vị mét, quyền điều khiển camera, clock; dựng lại browser test harness | Typecheck/test đạt; chuyển Mars ↔ Moon và Option 1 ↔ Option 2 reset đúng, không giữ input cũ |
| M1 — Bản lái hoàn chỉnh ở phạm vi nhỏ | Sojourner + LRV đại diện; terrain 2 × 2 km có dốc/rãnh/đá; physics, joystick, camera; bản nâng cấp asset đầu tiên | Lái được trên desktop/điện thoại; bánh bám đất, rãnh có tác động, phục hồi được khi kẹt; hình ảnh POV đủ làm mẫu chuẩn |
| M2 — Terrain streaming | Dữ liệu nguồn, manifest tile, LOD, collider, cache, floating origin; tăng 16 × 16 rồi 64 × 64 km | Chạy hành trình dài qua nhiều tile và lần dịch gốc không rơi, không nhảy camera; mạng chậm có trạng thái chờ an toàn |
| M3 — Hoàn thiện toàn bộ thiết bị bề mặt | Rig/PBR/LOD từng rover; flight controller; chế độ di chuyển giả lập của thiết bị cố định; lưu vị trí từng thiết bị | Mọi thiết bị có POV được gán đúng controller/camera; chuyển thiết bị không đổi sai môi trường hay scale |
| M4 — Trạm và tàu quỹ đạo | Clock/pose chung, camera gắn tàu, hành tinh chi tiết, pause/time warp | POV dịch chuyển theo quỹ đạo; đổi overview/POV không đổi vị trí hoặc pha thời gian ngoài ý muốn |
| M5 — Chất lượng phát hành | Tinh chỉnh ánh sáng/asset, auto quality, tải và bộ nhớ; responsive HUD; kiểm thử trên thiết bị thật | Đạt ngân sách đã chốt theo nhóm máy, không suy giảm tài nguyên qua nhiều lần đổi cảnh; có báo cáo hình ảnh và hiệu năng |

Không mở rộng bản đồ và toàn bộ danh mục trước khi M1 chứng minh được tiếp xúc bánh xe, cảm giác lái và ngân sách mobile. Sau M1 mới chốt dự toán thời gian toàn bộ dự án; khối lượng dựng/rig asset Apollo và phạm vi DEM chi tiết là hai biến số lớn chưa đủ dữ liệu để cam kết lịch.

## 9. Các cụm mã dự kiến thay đổi

| Cụm | Công việc |
| --- | --- |
| src/types/cosmos.types.ts; src/config/deviceManifest.json; src/config/validateCatalog.ts | Schema phân biệt transform xem mô hình và transform vật lý; capability và provenance |
| src/config/deviceSimulationProfiles.ts (mới); bodyPhysicsConfig.ts (mới) | Thông số thiết bị và môi trường có nguồn/nhãn giả lập |
| src/scene/simulation/* (mới) | SimulationWorld, RoverController, FlightController, SurfaceExplorationController, SimulationClock |
| src/scene/terrain/* (mới) | TerrainProvider, ChunkManager, TerrainTile, TerrainCollider, terrain.worker |
| src/scene/spacecraft/ControlRoomFirstPersonScene.tsx; DeviceModel.tsx; ProceduralDeviceModel.tsx | Lắp scene mô phỏng, model rig và camera mount; thay hardware proxy khi asset đã sẵn sàng |
| src/core/camera/SplineCameraRig.tsx; src/core/canvas/FloatingOriginManager.tsx | Camera mô phỏng độc lập và dịch gốc đồng bộ |
| src/scene/surface/SurfaceTerrainView.tsx; PlanetaryTerrainMesh.tsx; MarsTerrainPatch.tsx | Chuyển sang dùng chung terrain provider; duy trì chế độ showcase trong quá trình chuyển đổi |
| src/core/loaders/*; src/core/postprocessing/*; src/core/canvas/MarsCanvas.tsx | Cache/streaming theo renderer và tier, render loop theo scene, ánh sáng/hậu kỳ thích nghi |
| src/store/useCosmosStore.ts; UI/HUD hiện có | Trạng thái chế độ, lựa chọn thiết bị, checkpoint và telemetry; pose mỗi frame nằm trong simulation runtime, UI cập nhật khoảng 5–10 Hz |
| src/config/celestialCatalog.ts; src/scene/spacecraft/OrbitalFleet.tsx | Pose quỹ đạo dùng chung và kiểm chứng công thức |
| scripts/*; public/assets/*; docs/SOURCES.md; tests/* | Pipeline tile/LOD/rig, asset manifest, nguồn dữ liệu và kiểm thử mới |

## 10. Kiểm thử và bằng chứng nghiệm thu

- Kịch bản vật lý: nền phẳng, dốc dọc/dốc ngang, đá nhỏ, bậc, rãnh hẹp, hố sâu, mắc gầm và lật; ngưỡng thành công theo từng profile, ghi trace tiếp xúc bánh và pose để chẩn đoán.
- Hình ảnh/collider: độ cao mặt đất và collider tại điểm tiếp xúc sai lệch không quá 5% bán kính bánh nhỏ nhất trong bộ thử; kiểm tra riêng mép tile và vùng đổi LOD. Ngưỡng này cần được xác nhận khả thi ở M1.
- Tái lập: cùng seed/input/timestep cho kết quả hành trình trong dung sai đã chốt ở render 30/60/120 FPS và ở mọi quality tier; không yêu cầu bitwise-identical giữa các nền tảng.
- Terrain lớn: hành trình ít nhất 10 km, đi qua nhiều chunk và ít nhất ba lần dịch gốc; không mất collider/vệt đường hoặc sai đơn vị. Đặt checkpoint xa gốc và khôi phục đúng.
- Điều khiển: desktop, multi-touch, pause/resume, mất focus, pointercancel, đổi thiên thể khi đang tải, đổi thiết bị và quay lại POV; không có phím/joystick bị giữ.
- Quỹ đạo: kiểm tra vị trí sau một chu kỳ, điểm gần/xa, hướng nhìn, pause/time warp và sự đồng nhất overview/POV; không áp dụng time warp quỹ đạo vào physics bề mặt.
- Tải/lỗi: giả lập mạng chậm, tile hỏng, thiếu texture và asset decode lỗi; có placeholder phù hợp, retry, phanh/chờ đúng và giải phóng tài nguyên tải dở.
- Hiệu năng: đo FPS/frame time p50/p95, draw calls, tải mạng, tài nguyên CPU/GPU ước tính, 15 phút chạy liên tục và ít nhất 20 lần đổi cảnh. Mục tiêu ban đầu p95 ≤40 ms ở Low và ≤20 ms ở High, đối chiếu cả tốc độ khung hình duy trì.
- So sánh hình ảnh theo các góc cố định: bánh/chassis/foil/panel nhìn gần, rãnh có ánh sáng xiên, đường chân trời, cabin trạm. Đạt tiêu chí hình ảnh trên thiết bị thật, không chỉ screenshot từ software renderer.
- Bộ lệnh khi triển khai: npm test, npm run typecheck, npm run validate:assets, npm run build, npm run test:browser sau khi đã bổ sung browser tests. Giữ hồ sơ asset/nguồn và cập nhật checklist theo từng mốc.

Các giới hạn cần quản lý: chưa có GLB bề mặt Apollo hoàn chỉnh; chưa kiểm chứng rig/tỉ lệ vật lý mọi asset; chưa tích hợp DEM nguồn; chưa có benchmark trên điện thoại thật. Hoàn thành kế hoạch không đồng nghĩa những phụ thuộc này đã được giải quyết.

## 11. Kế hoạch bổ sung GLB Mặt Trăng từ nguồn có sẵn

Mục tiêu là bổ sung mô hình Mặt Trăng có nguồn gốc kiểm chứng được thay vì tự dựng các mô hình phương tiện/địa hình mới từ đầu. Ưu tiên tải asset gốc có thể sử dụng; chỉ chuyển đổi định dạng hoặc tối ưu khi cần, giữ nguyên file nguồn và ghi lại quy trình. Kiểm tra các trang nguồn dưới đây vào ngày 15/11/2026; chưa có asset nào trong danh sách này được nhập vào ứng dụng.

**Hiện trạng catalog:** sáu hồ sơ bề mặt Apollo trong `src/config/deviceManifest.json` (`apollo_lrv`, `apollo_lrv_deployment`, `apollo_15_lrv`, `apollo_17_lrv`, `apollo_surface_equipment`, `apollo_lm_equipment`) hiện có `status: "unavailable"` và tham chiếu `proceduralModel`. Đây là proxy hình học procedural; mã nguồn đã kiểm tra chưa chứng minh chúng là AI-generated, vì vậy không ghi nhãn “AI-generated” nếu chưa có provenance xác nhận. Thư mục `public/assets/models/moons/` hiện có GLB cho Apollo CSM, LRO, Phobos, Deimos và terrain Mặt Trăng, không có GLB LRV/Lunar Module bề mặt.

### Nguồn và ứng viên

| Ứng viên | Định dạng/tình trạng đã kiểm tra | Cách dùng dự kiến và giới hạn |
| --- | --- | --- |
| [NASA Science 3D Resources](https://science.nasa.gov/3d-resources/) | Danh mục NASA có các model tải được; trang nêu asset miễn phí tải xuống và sử dụng | Nguồn ưu tiên. Xác minh trang và ghi chú quyền sử dụng của từng asset, không suy rộng quyền từ một model sang toàn bộ nội dung bên thứ ba |
| [Apollo Lunar Module](https://science.nasa.gov/3d-resources/apollo-lunar-module/) | Có file `Apollo Lunar Module.glb`, khoảng 700 KB | Ưu tiên nhập làm model bề mặt và mẫu kiểm chứng tải GLB, sau khi kiểm tra node, hướng, tỉ lệ và chất lượng mesh. Bản [Innerscene](https://www.innerscene.com/tools/library/3d-parts/apollo-lunar-module-8f760425) là bản sao dẫn về nguồn NASA; ưu tiên tải bản chính thức |
| [Apollo 15 – Landing Site](https://science.nasa.gov/3d-resources/apollo-15-landing-site/) | Có STL khoảng 6.74 MB; mô tả vùng 30 × 30 km và phóng đại trục Z lên 25 lần; không có GLB trực tiếp | Ứng viên địa hình khu vực sau khi chuyển đổi có kiểm soát và khôi phục đúng tỉ lệ đứng. Không coi mesh này là dữ liệu va chạm cấp bánh xe hay DEM đo đạc chi tiết nếu chưa kiểm chứng độ phân giải và datum |
| [NASA SVS – Moon 3D Models for Web, AR, and Animation](https://svs.gsfc.nasa.gov/14959/) | Có các GLB toàn cầu, gồm bản màu khoảng 13.2/51.4 MB và bản địa hình `Moon_NASA_LRO_8k_Topo_Small.glb` khoảng 77.7 MB; bản topo đầy đủ khoảng 298.9 MB | Đánh giá làm model globe hoặc tham chiếu địa hình, không thay thế tile địa hình cục bộ cho lái xe. Chú ý chi phí tải/bộ nhớ và lỗi chụm cực được trang nguồn nêu |
| [NASA Astromaterials 3D – mẫu Apollo 15](https://ares.jsc.nasa.gov/astromaterials3d/sample-catalog.htm?origin=A15) | Danh mục mẫu quét 3D; định dạng, file tải và quyền của từng mẫu cần kiểm tra riêng | Có thể dùng làm đạo cụ mẫu đá, không phải địa hình hay model phương tiện. Chỉ nhập sau khi xác minh file gốc, điều khoản và attribution cụ thể |
| [CGTrader](https://www.cgtrader.com/de/3d-modelle/apollo) và [Free3D – LRV](https://free3d.com/3d-model/lunar-roving-vehicle-from-apollo-15-rigged-7196.html) | Nguồn bên thứ ba; điều kiện miễn phí/trả phí và giấy phép phụ thuộc từng model. Trang Free3D chưa được xác minh trong lần kiểm tra này | Chỉ là nguồn dự phòng nếu không tìm được asset chính thức phù hợp. Không nhập chỉ vì trang gắn nhãn “free”; cần kiểm tra giấy phép, độ chính xác, rig, attribution và quyền phân phối |

NASA 3D Resources nêu quyền tải và sử dụng asset của danh mục, nhưng vẫn phải tuân thủ [NASA Images and Media Usage Guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/), ghi credit và tránh hàm ý NASA chứng thực ứng dụng. NASA insignia/logotype và một số nội dung bên thứ ba có các hạn chế riêng; không đưa logo NASA vào giao diện chỉ dựa trên việc model là nguồn NASA.

### Các bước tích hợp

1. **Lập shortlist theo vai trò**: tìm asset NASA trước trong 3D Resources và NASA-3D-Resources trên GitHub; tìm vật mẫu/đá ở Astromaterials 3D và địa hình ở NASA SVS. Nếu thiếu, khảo sát community model trên Innerscene, Sketchfab, CGTrader và Free3D. Chọn model khớp thiết bị; không dùng GLB globe để thay LRV hoặc dùng model toàn cầu làm terrain lái xe.
2. **Duyệt giấy phép trước khi tải vào runtime**: lưu trang nguồn cụ thể, tác giả, giấy phép, quyền chỉnh sửa/phân phối và yêu cầu credit. CC0/public domain được dùng theo điều kiện tương ứng; CC BY phải có attribution; CC BY-SA phải giữ nghĩa vụ chia sẻ tương tự với bản chuyển đổi; loại asset NC/ND, quyền không rõ, hoặc chỉ được xem nếu không đáp ứng mục đích phân phối. Tên website hay nhãn “free/open-source” không thay cho giấy phép của model cụ thể. Không dùng online converter nếu chưa rõ quyền tải lên và quyền với file tạo ra.
3. **Tải và chuyển đổi có thể tái lập**: lưu bản gốc và giấy phép trong hồ sơ nguồn; nếu chỉ có STL/OBJ, chuyển bằng Blender/công cụ cục bộ đã khóa phiên bản. Ghi rõ đơn vị, trục, tỉ lệ, xử lý texture và mọi hiệu chỉnh; giữ checksum file gốc và GLB đầu ra. Không bỏ hệ số phóng đại đứng của Apollo 15 khi chưa khôi phục đúng tỉ lệ.
4. **Ghép model vào hồ sơ đúng nghĩa**: ưu tiên dùng cùng một GLB LRV cho hồ sơ Apollo 15/17 nếu nguồn chỉ có model chung, và ghi rõ đây là hình dạng tham khảo chung, không phải hai bản quét riêng theo từng nhiệm vụ. Chỉ bật chế độ triển khai/animation nếu GLB có node, pivot hoặc clip đã xác minh. Lunar Module GLB không tự động thay thế bộ MESA/thiết bị bề mặt. Hồ sơ không có model tương ứng tiếp tục `unavailable`, không gán nhầm asset.
5. **Đăng ký catalog và provenance**: đặt GLB runtime phù hợp dưới `public/assets/models/moons/`; khai báo metadata trong `src/config/deviceManifest.json` và catalog/dossier/control profile liên quan. Ghi tên asset, mission, URL nguồn trực tiếp, tác giả/credit, giấy phép, checksum, đơn vị, physical-scale status và giới hạn. Model chưa rig/scale-verify chỉ được dùng ở chế độ xem; không bật điều khiển hoặc va chạm theo kích thước thực.
6. **Tối ưu và kiểm tra**: giữ bản gốc, tạo bản runtime cần thiết với LOD, mipmap/nén và giới hạn dung lượng; không tải GLB địa hình toàn cầu 299 MB trên mobile. Kiểm tra GLB trên desktop/mobile, fallback và giải phóng tài nguyên; chạy `npm run validate:assets`, `npm test`, `npm run build` và browser tests. Bổ sung nguồn được chọn vào `docs/SOURCES.md`; không xóa placeholder cũ trước khi model thay thế qua nghiệm thu.

### Điều kiện nghiệm thu

- Mỗi asset phát hành có URL gốc, giấy phép/điều khoản, credit, checksum và ghi chú giới hạn; không có file chỉ ghi “NASA/public domain” mà thiếu nguồn cụ thể.
- Apollo Lunar Module GLB tải được và hiển thị đúng; model LRV chỉ được bật khi đã xác minh nguồn, rig và scale tương ứng với chức năng được cung cấp.
- Model Moon toàn cầu chỉ phục vụ globe/tham chiếu; terrain vùng lái dùng dữ liệu có scale và nguồn riêng, không dùng mesh Apollo 15 phóng đại 25 lần trực tiếp làm collider.
- Không tạo model thay thế khi chưa tìm thấy asset có quyền sử dụng; giữ trạng thái `unavailable` và nêu rõ lý do thay vì gắn model không xác minh.
- Không vượt ngân sách tải/bộ nhớ mobile đã chốt ở M5; bản 8K/độ phân giải cao chỉ tải theo tier và sau khi đo trên thiết bị mục tiêu.

## 12. Kế hoạch chatbot hỏi đáp dự án với mascot 3D RISE

Trạng thái: đề xuất, chưa triển khai. Chatbot trả lời câu hỏi về các chủ đề của VantaLumen: Sao Hỏa/Mặt Trăng, sứ mệnh và thiết bị, điều khiển, mô phỏng, địa hình, asset, nguồn dữ liệu và cách sử dụng ứng dụng. Câu trả lời cần bám theo tài liệu/mã nguồn của dự án, kèm nguồn tham chiếu và phân biệt dữ kiện đã xác minh với nội dung minh họa hoặc mô phỏng.

### Kiến trúc hỏi đáp và bảo vệ API

- Dùng Gemini Flash qua một backend endpoint cùng origin, dự kiến Vercel Function `api/chat.ts`; trình duyệt không gọi Gemini trực tiếp. Xác nhận chính xác tên model/API, giới hạn quota miễn phí và điều khoản hiện hành khi bắt đầu triển khai; không mặc định quota miễn phí là không giới hạn.
- API key đã được chia sẻ trong hội thoại trước đó: thu hồi key cũ và tạo key mới. Lưu key mới trong Vercel Environment Variables phía server (ví dụ `GEMINI_API_KEY`); không đặt trong `VITE_*`, mã frontend, URL, log, prompt phía client hoặc Git.
- Endpoint kiểm tra kiểu và kích thước đầu vào, giới hạn độ dài câu trả lời, timeout và xử lý lỗi rõ ràng; áp dụng rate limit và chỉ chấp nhận request cùng origin. Không lưu hội thoại ở server trong bản đầu; không ghi key hoặc nội dung nhạy cảm vào log.
- Tạo chỉ mục nhỏ, có thể tái lập từ `README.md`, `docs/SOURCES.md`, tài liệu kế hoạch, `src/config/*` (catalog, dossiers, control specs, simulation profiles) và nội dung trợ giúp đã duyệt. Mỗi đoạn có tiêu đề, đường dẫn nguồn, loại nguồn và ngôn ngữ. Bắt đầu bằng tìm kiếm từ khóa/BM25; chỉ thêm embedding khi đánh giá cho thấy cần thiết.
- Chỉ đưa các đoạn liên quan cùng metadata nguồn vào Gemini. System prompt yêu cầu trả lời dựa trên bằng chứng, dẫn link hoặc tên file/section, không khẳng định terrain tổng hợp hay model proxy là dữ liệu NASA đo đạc, và nói rõ khi không tìm được câu trả lời. Nội dung người dùng/tài liệu truy xuất là dữ liệu, không phải chỉ thị để chạy công cụ hay tiết lộ cấu hình.

### Widget và mascot 3D

- Thêm widget dùng chung ở `src/App.tsx`: khi thu gọn mascot RISE trôi nhẹ quanh một vùng an toàn của viewport, người dùng có thể kéo-thả mascot tới vị trí khác; click/tap không phải thao tác kéo sẽ mở cửa sổ chat nhỏ. Dùng pointer capture và xử lý `pointercancel`/resize; áp dụng ngưỡng di chuyển để thao tác kéo không vô tình mở chat. Lưu vị trí an toàn trong phiên, kẹp mascot trong viewport và tránh che điều khiển quan trọng. Khi chat mở, dừng chuyển động mascot. Có nút đóng/thu gọn, lịch sử trong phiên hiện tại, ô nhập, trạng thái đang trả lời, lỗi và nguồn tham khảo.
- Kiểm tra quyền sử dụng, provenance, node, vật liệu, animation, kích thước và bounds của file người dùng cung cấp `D:\rise_plushie.glb` trước khi đưa vào runtime. Nếu được phép, đặt bản runtime có checksum tại `public/assets/mascot/rise_plushie.glb`; dùng loader React Three Fiber/Drei hiện có, không dựng lại model từ đầu.
- Giữ widget cố định theo viewport trên mọi view mode và phù hợp với HUD/mobile. Do ứng dụng đã có nhiều scene/canvas 3D, ưu tiên gắn mascot vào renderer đang hoạt động; nếu phải dùng canvas nhỏ riêng, đo tác động GPU và chỉ render khi hiển thị/cần thiết. Tôn trọng Auto/Low quality, `prefers-reduced-motion`, và dừng chuyển động/render khi widget bị ẩn.
- Hỗ trợ focus rõ ràng, nhãn accessible, Enter gửi, Shift+Enter xuống dòng, Escape đóng, giữ focus trong hộp thoại khi mở và trả focus về nút mascot khi đóng. Cho phép di chuyển mascot bằng phím mũi tên khi launcher có focus và Enter/Space để mở; `pointerdown` trên mascot không được kích hoạt joystick/camera của scene. Trên mobile, hỗ trợ touch drag, không chặn cuộn ngoài vùng mascot, không che điều khiển mô phỏng hoặc làm tràn viewport.
- Chỉ dùng tên/nhận diện RISE và nội dung NASA theo quyền đã xác minh; không dùng insignia/logotype hoặc tạo hàm ý NASA chứng thực VantaLumen nếu chưa được cho phép.

### Thứ tự thực hiện và điều kiện nghiệm thu

| Mốc | Công việc / đầu ra | Điều kiện nghiệm thu |
| --- | --- | --- |
| C0 — Chuẩn bị an toàn | Thu hồi API key đã lộ, thiết lập secret server-side, xác nhận model/quota/endpoint và quyền dùng mascot | Không còn key trong client/Git/log; quyền sử dụng model được ghi nhận |
| C1 — Kiến thức và backend | Chỉ mục nguồn có version, endpoint Gemini, giới hạn request, trích dẫn và thông báo lỗi | Test với câu hỏi có/không có nguồn; câu trả lời dẫn nguồn đúng, từ chối đoán khi thiếu bằng chứng; rate limit và lỗi provider hoạt động |
| C2 — Chat UI | Widget và cửa sổ hội thoại responsive, trạng thái tải/lỗi, accessible keyboard flow | Chạy được ở desktop/mobile và mọi view mode; gửi/đóng/mở không chặn điều khiển chính |
| C3 — Mascot RISE | Audit, tối ưu và tích hợp GLB vào launcher; chuyển động tự trôi, drag/touch drag và click mở chat | Kéo không mở nhầm chat; click/keyboard mở đúng; resize/pointercancel không làm mất mascot; không xung đột input scene; reduced-motion và ẩn widget dừng chuyển động/render |
| C4 — Đánh giá và phát hành | Bộ câu hỏi chuẩn theo chủ đề, kiểm thử nguồn, hiệu năng và triển khai preview | Không có key ở client; nội dung khoa học có nguồn; không bịa khi không có nguồn; đạt mục tiêu hiệu năng mobile đã đo và có attribution |

Các file dự kiến: `api/chat.ts`, `src/ui/chat/ProjectChatWidget.tsx`, `src/scene/mascot/RiseMascot.tsx`, `public/assets/mascot/rise_plushie.glb`, script tạo chỉ mục và test API/UI. Đây là phạm vi dự kiến; chỉ thêm endpoint Gemini và model sau khi hoàn tất C0.

## 13. Quy trình hoàn chỉnh thay asset và xác minh model trên website

### Kiểm kê hiện tại đã kiểm tra

- Website đặt trong GitHub homepage là [vantalumen-atlas.vercel.app](https://vantalumen-atlas.vercel.app); `vercel.json` cấu hình Vite với `dist` là output directory. Cấu hình trong repo không tự chứng minh một lần deploy cụ thể đã thành công.
- `public/assets/models/` hiện có 27 GLB (15 `mars`, 7 `moons`, 2 `spacecraft`, 3 `stations`), tổng 79,515,088 bytes. Bản `dist/assets/models/` đã kiểm tra có đủ 27 file với tổng kích thước bằng source.
- `npm run validate:assets` đã xác nhận 21 model loadable và 6 terrain manifests hợp lệ. Kiểm tra HTTP HEAD production ngày 15/11/2026 cho 27 GLB hiện có đều trả `200` và `Content-Length` trùng file local. Đây là kiểm tra khả năng truy cập/kích thước, không thay thế kiểm tra checksum từ response hoặc xác nhận GLB đã giải mã/render thành công trên browser.
- Điều còn thiếu: 6 hồ sơ thiết bị bề mặt Mặt Trăng chưa có modelPath GLB; không được coi việc 27 file hiện tại tải được là đã hoàn tất thay thế các placeholder Apollo.

### Luồng phát hành cho mọi model Mars/Moon

1. **Định nghĩa inventory kỳ vọng**: tạo script kiểm tra tất cả `modelPath` từ device manifest, celestial catalog và các model terrain được ứng dụng sử dụng; xác nhận file có trong `public/assets/` và không tham chiếu đường dẫn ngoài runtime. Ghi riêng file GLB không được catalog dùng (ví dụ bản nén/LOD) để không nhầm với thiết bị người dùng có thể chọn.
2. **Kiểm tra source và catalog**: chạy asset validator; xác nhận bytes/SHA-256, attribution/license, trạng thái `available`/`unavailable`, URL nguồn, và phân biệt model bề mặt, mô hình quỹ đạo, terrain globe và tile va chạm. Model chưa có bằng chứng nguồn vẫn giữ unavailable.
3. **Build và đối chiếu output**: chạy test, typecheck, `npm run validate:assets`, `npm run build`; sau build, đối chiếu từng đường dẫn catalog với `dist`, số byte và checksum source→dist. Build phải fail nếu một model được khai báo available nhưng thiếu file hoặc sai hash.
4. **Deploy preview**: tạo preview deployment từ commit chứa manifest và assets; không xóa asset cũ trong cùng đợt thay model. Ghi deployment URL, commit SHA và inventory manifest dùng để kiểm tra.
5. **Xác minh web preview**: với mọi modelPath dự kiến, kiểm tra HTTPS GET/HEAD trả 200, MIME phù hợp, Content-Length và SHA-256 khớp; sau đó tải/giải mã model bằng loader của ứng dụng. Mở từng model có thể chọn qua UI ở Mars và Moon; xác nhận không có 404, lỗi decoder/CORS, vật liệu hỏng, scale/orientation sai hoặc lỗi console. Kiểm tra tối thiểu desktop, viewport mobile, Auto/Low quality và đổi thiên thể.
6. **Promote và hậu kiểm**: chỉ đưa preview đã đạt vào production; chạy lại kiểm tra inventory trên production URL và một browser smoke test sau deploy. Lưu kết quả (commit, URL, count, checksum, test) trong release record. Nếu URL/GLB/hash/render không đạt, rollback deployment hoặc đặt đúng entry về unavailable trước khi gỡ file; không để UI báo model sẵn sàng khi file hỏng/thiếu.

### Điều kiện bàn giao

- Tất cả modelPath `available` của cả hai thiên thể trả về asset đúng trên production và GLB giải mã thành công; toàn bộ GLB runtime được yêu cầu lưu trữ đều có trong inventory deploy.
- Không gộp LOD, orbiters, terrain và thiết bị bề mặt thành một nhóm không phân biệt; tên, nguồn và nhiệm vụ của từng model hiển thị đúng trong UI.
- Các thay đổi mới về Moon GLB chỉ được đánh dấu hoàn tất sau preview + production checks; kết quả HEAD hiện tại không được dùng làm bằng chứng cho asset mới chưa phát hành.
- Mascot/chat có kiểm thử riêng cho drag/click/keyboard, touch, pointercancel, resize, reduced-motion và không làm hỏng điều khiển mô phỏng.
