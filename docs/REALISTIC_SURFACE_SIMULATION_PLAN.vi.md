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
