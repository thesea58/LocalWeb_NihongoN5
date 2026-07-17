#!/usr/bin/env python3
"""Add a Vietnamese memory aid to every TOEIC vocabulary entry.

The generator deliberately avoids invented etymologies. It prefers, in order:
1. a hand-reviewed explanation for easily confused/high-value words;
2. a transparent compound or affix explanation;
3. a reliable synonym/contrast;
4. the word's own TOEIC example context.

Run from the repository root:
    python scripts/add_toeic_memory_tips_vi.py
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

DATA_PATH = Path("FlashCard/data/Eng-Ja-Vi/toeic_600_essential_words_en_vi.json")

CATEGORY_VI = {
    "Financial Statements": "báo cáo tài chính",
    "Taxes": "thuế",
    "Investments": "đầu tư",
    "Accounting": "kế toán",
    "Banking": "ngân hàng",
    "Inventory": "hàng tồn kho",
    "Invoices": "hóa đơn",
    "Shipping": "vận chuyển",
    "Ordering": "đặt hàng",
    "Shopping": "mua sắm",
    "Promotions, Pensions and Awards": "thăng chức, lương hưu và khen thưởng",
    "Salaries and Benefits": "lương và phúc lợi",
    "Hiring and Training": "tuyển dụng và đào tạo",
    "Applying and Interviewing": "ứng tuyển và phỏng vấn",
    "Job Advertising and Recruiting": "đăng tuyển và chiêu mộ nhân sự",
    "Correspondence": "thư tín công việc",
    "Electronics": "thiết bị điện tử",
    "Office Procedures": "quy trình văn phòng",
    "Office Technology": "công nghệ văn phòng",
    "Computers": "máy tính",
    "Conferences": "hội nghị",
    "Business Planning": "lập kế hoạch kinh doanh",
    "Warranties": "bảo hành",
    "Marketing": "tiếp thị",
    "Contracts": "hợp đồng",
    "Pharmacy": "nhà thuốc",
    "Hospitals": "bệnh viện",
    "Health Insurance": "bảo hiểm y tế",
    "Dentist's Office": "phòng nha",
    "Doctor's Office": "phòng khám bác sĩ",
    "Media": "truyền thông",
    "Museums": "bảo tàng",
    "Music": "âm nhạc",
    "Theater": "sân khấu",
    "Movies": "điện ảnh",
    "Car Rentals": "thuê xe",
    "Hotels": "khách sạn",
    "Trains": "tàu hỏa",
    "Airlines": "hàng không",
    "General Travel": "du lịch nói chung",
    "Events": "sự kiện",
    "Cooking as a Career": "nghề nấu ăn",
    "Ordering Lunch": "gọi món ăn trưa",
    "Eating Out": "ăn ngoài",
    "Selecting a Restaurant": "chọn nhà hàng",
    "Renting and Leasing": "thuê và cho thuê",
    "Product Development": "phát triển sản phẩm",
    "Quality Control": "kiểm soát chất lượng",
    "Board Meetings and Committees": "họp hội đồng và ủy ban",
    "Property and Department": "bất động sản và phòng ban",
}

# Hand-reviewed explanations for words whose TOEIC meaning is easy to confuse.
SPECIAL_TIPS = {
    "yield": "Trong tài chính, yield là lợi suất/khoản sinh ra từ đầu tư; gần return, nhưng yield thường nhấn vào tỷ lệ hoặc phần thu được.",
    "typically": "typical là điển hình; thêm -ly thành trạng từ typically = thường xảy ra theo kiểu điển hình.",
    "translation": "translation là danh từ của translate: chuyển nội dung từ ngôn ngữ hoặc dạng này sang dạng khác; đừng nhầm với interpretation là phiên dịch/diễn giải trực tiếp.",
    "target": "Hình dung tâm bia là target: vừa là mục tiêu, vừa là động từ nhắm tới một kết quả.",
    "realistic": "real + -istic: dựa trên điều có thật và khả thi; trái với unrealistic, khác idealistic là thiên về lý tưởng.",
    "project": "Khi là động từ trong kinh doanh, project nghĩa là phóng con số về phía trước để dự tính; khác project /ˈprɑːdʒekt/ là danh từ dự án.",
    "perspective": "Gốc spect liên quan đến nhìn; perspective là góc nhìn/cách nhìn một vấn đề, gần viewpoint.",
    "overall": "over + all: bao trùm lên tất cả, nên nghĩa là tổng thể hoặc xét chung.",
    "level": "Hình dung một vạch ngang trên thang đo: level là mức/cấp độ tại vị trí đó.",
    "forecast": "fore = trước, cast = đưa/phóng ra; forecast là đưa ra dự đoán trước, gần predict nhưng rất hay dùng cho thời tiết và tài chính.",
    "detail": "detail là từng điểm nhỏ cụ thể; động từ detail nghĩa là trình bày đầy đủ các điểm nhỏ đó.",
    "desire": "desire gần want nhưng mạnh và trang trọng hơn: mong muốn/khao khát một điều.",
    "withhold": "with + hold = giữ lại; trong bảng lương thường là giữ/khấu trừ một phần tiền để nộp thuế.",
    "spouse": "spouse là cách gọi trung tính và trang trọng cho vợ hoặc chồng; thường gặp trong biểu mẫu thuế, bảo hiểm.",
    "deduct": "deduct là trừ một khoản khỏi tổng; deduction là khoản khấu trừ. Đừng nhầm với reduce chỉ giảm nói chung.",
    "exempt": "exempt = được miễn khỏi một nghĩa vụ; thường đi với from: be exempt from tax.",
    "file": "Trong thuế, file là nộp/khai hồ sơ chính thức; khác file danh từ là tập tin hoặc hồ sơ.",
    "joint": "joint nghĩa là chung/cùng nhau; joint tax return là tờ khai thuế chung của hai vợ chồng.",
    "refund": "re- = trở lại, fund = tiền; refund là tiền được trả lại hoặc hành động hoàn tiền.",
    "revenue": "revenue là doanh thu trước khi trừ chi phí; profit mới là lợi nhuận còn lại sau chi phí.",
    "profit": "profit = phần còn lại có lãi sau khi trừ chi phí; khác revenue là toàn bộ doanh thu.",
    "asset": "asset là tài sản có giá trị thuộc sở hữu; trái với liability là nghĩa vụ/nợ phải trả.",
    "liability": "liability trong kế toán là khoản nợ/nghĩa vụ phải trả; đối lập với asset là tài sản.",
    "equity": "Trong tài chính, equity là phần giá trị thuộc chủ sở hữu sau khi lấy tài sản trừ nợ phải trả.",
    "principal": "Trong ngân hàng, principal là tiền gốc; interest là tiền lãi. Đừng nhầm principal với principle là nguyên tắc.",
    "interest": "Trong ngân hàng, interest là lãi trả cho việc vay/gửi tiền; trong ngữ cảnh khác mới là sự quan tâm.",
    "deposit": "de- + posit (đặt): deposit là đặt tiền vào tài khoản hoặc khoản tiền đặt cọc.",
    "withdraw": "with + draw: kéo/rút ra; trong ngân hàng là rút tiền, trái với deposit.",
    "balance": "balance là số tiền còn lại trong tài khoản sau các khoản cộng và trừ; cũng mang nghĩa trạng thái cân bằng.",
    "inventory": "inventory là toàn bộ hàng hóa/nguyên vật liệu doanh nghiệp đang có; gần stock trong ngữ cảnh hàng tồn.",
    "stock": "Trong kho, stock là lượng hàng sẵn có; trong đầu tư, stock là cổ phiếu. Hãy chọn nghĩa theo chủ đề.",
    "invoice": "invoice là hóa đơn người bán gửi để yêu cầu thanh toán; receipt là biên lai chứng minh đã trả tiền.",
    "receipt": "receipt chứng minh tiền đã được nhận/đã thanh toán; invoice thường là yêu cầu thanh toán trước đó.",
    "due": "Trong hóa đơn, due nghĩa là đến hạn phải trả; amount due là số tiền cần thanh toán.",
    "overdue": "over + due: đã vượt quá ngày đến hạn, nên nghĩa là quá hạn.",
    "shipment": "ship + -ment: một lô hàng hoặc việc gửi hàng; shipping là hoạt động vận chuyển nói chung.",
    "freight": "freight là hàng hóa được vận chuyển với số lượng lớn hoặc cước vận tải hàng hóa.",
    "carrier": "carry + -er: đơn vị/người mang và vận chuyển; trong logistics là hãng vận tải.",
    "order": "order có thể là đơn đặt hàng hoặc hành động đặt hàng; trong văn phòng còn có nghĩa mệnh lệnh/thứ tự.",
    "purchase": "purchase trang trọng hơn buy và rất hay dùng trong TOEIC: mua hàng hoặc giao dịch mua.",
    "merchandise": "merchandise là hàng hóa để bán; gần goods/products nhưng nhấn vào hàng thương mại trong cửa hàng.",
    "bargain": "bargain là món mua có giá hời hoặc việc thương lượng giá; không chỉ đơn giản là cheap.",
    "discount": "discount là phần giá được giảm khỏi giá niêm yết; khác refund là tiền trả lại sau giao dịch.",
    "promotion": "promotion có thể là thăng chức hoặc chương trình khuyến mãi; chủ đề câu sẽ quyết định nghĩa.",
    "pension": "pension là khoản lương hưu trả định kỳ sau khi nghỉ việc; khác salary là lương khi đang làm.",
    "benefit": "benefit trong nhân sự là phúc lợi ngoài lương; cũng có thể là lợi ích nói chung.",
    "compensation": "compensation là tổng tiền/thù lao bù đắp cho công việc hoặc thiệt hại; rộng hơn salary.",
    "eligible": "eligible = đủ điều kiện theo quy định; thường đi với for hoặc to, khác capable là có năng lực làm.",
    "qualification": "qualification là bằng cấp, kỹ năng hoặc điều kiện chứng minh một người phù hợp với công việc.",
    "candidate": "candidate là người được xem xét cho một vị trí; applicant là người đã nộp đơn, hai nhóm có thể trùng nhau.",
    "applicant": "apply + -ant: người nộp đơn; applicant nhấn vào hành động ứng tuyển, candidate nhấn vào việc được cân nhắc.",
    "resume": "Trong tuyển dụng, résumé là sơ yếu lý lịch; đừng nhầm resume /rɪˈzuːm/ là tiếp tục.",
    "reference": "Trong hồ sơ việc làm, reference là người/thông tin xác nhận năng lực; không chỉ là tài liệu tham khảo.",
    "vacancy": "vacant = trống; vacancy là vị trí còn trống cần tuyển hoặc phòng còn trống.",
    "recruit": "recruit là chủ động tìm và thu hút người vào tổ chức; hire là quyết định thuê họ làm việc.",
    "correspondence": "correspond + -ence: thư từ/trao đổi viết qua lại; thường là email và thư công việc.",
    "attachment": "attach + -ment: thứ được gắn kèm; trong email là tệp đính kèm.",
    "enclose": "en- + close: đặt thứ gì vào bên trong; trong thư từ là gửi kèm tài liệu trong phong bì/thư.",
    "forward": "Trong email, forward là chuyển tiếp thư cho người khác; khác reply là trả lời người gửi.",
    "device": "device là thiết bị được chế tạo cho một mục đích; equipment thường là tập hợp thiết bị và không đếm được.",
    "appliance": "appliance thường là thiết bị điện dùng cho một công việc cụ thể, nhất là gia dụng/văn phòng.",
    "compatible": "compatible = có thể hoạt động phù hợp cùng nhau; thường đi với with.",
    "install": "install là cài phần mềm hoặc lắp thiết bị để sẵn sàng sử dụng; installation là quá trình/hệ thống đã lắp.",
    "procedure": "procedure là chuỗi bước chính thức cần làm; process là quá trình rộng hơn, có thể tự nhiên hoặc không chính thức.",
    "implement": "implement là đưa một kế hoạch/chính sách vào thực tế; không chỉ tạo ra mà phải bắt đầu áp dụng.",
    "schedule": "schedule là lịch sắp xếp theo thời gian; động từ schedule là ấn định thời điểm.",
    "deadline": "dead + line: vạch cuối không được vượt; deadline là hạn chót.",
    "postpone": "postpone = dời sang thời điểm muộn hơn, gần delay; cancel là hủy hoàn toàn.",
    "conference": "conference là hội nghị để trao đổi; meeting có thể nhỏ và thường ngày hơn.",
    "agenda": "agenda là danh sách việc/chủ đề sẽ bàn trong cuộc họp; minutes là biên bản ghi lại điều đã bàn.",
    "minutes": "Trong họp, minutes là biên bản cuộc họp, không phải đơn vị phút; luôn đọc theo ngữ cảnh.",
    "objective": "objective là mục tiêu cụ thể, có thể đo được; goal thường rộng và dài hạn hơn.",
    "strategy": "strategy là định hướng/cách tiếp cận tổng thể; tactic là hành động cụ thể để thực hiện strategy.",
    "budget": "budget là kế hoạch giới hạn tiền cho một thời kỳ; expense là khoản chi thực tế.",
    "warranty": "warranty là cam kết của nhà sản xuất sửa/đổi trong điều kiện nhất định; guarantee rộng hơn và có thể là lời bảo đảm.",
    "guarantee": "guarantee là bảo đảm một kết quả/chất lượng; warranty thường là văn bản bảo hành sản phẩm có điều kiện.",
    "defect": "defect là lỗi vốn có làm sản phẩm không đạt chuẩn; damage là hư hại có thể xảy ra sau đó.",
    "market": "market có thể là thị trường hoặc động từ tiếp thị; marketing là toàn bộ hoạt động nghiên cứu và quảng bá để bán.",
    "advertise": "advertise là quảng cáo công khai; promote rộng hơn, gồm nhiều cách thúc đẩy sản phẩm hoặc người.",
    "consumer": "consumer là người cuối cùng sử dụng hàng hóa/dịch vụ; customer là người mua, có thể mua cho người khác.",
    "contract": "contract là thỏa thuận có tính ràng buộc; agreement rộng hơn và không phải lúc nào cũng là hợp đồng pháp lý.",
    "clause": "clause là một điều khoản riêng trong hợp đồng; contract là toàn bộ văn bản thỏa thuận.",
    "comply": "comply = làm đúng yêu cầu/quy định; thường đi với with: comply with regulations.",
    "obligation": "obligation là nghĩa vụ bắt buộc về pháp lý hoặc đạo đức; gần duty nhưng thường trang trọng hơn.",
    "prescription": "prescription là đơn thuốc do người có chuyên môn kê; medicine là thuốc nói chung.",
    "dosage": "dosage là liều lượng quy định dùng thuốc; dose là một liều cụ thể mỗi lần.",
    "symptom": "symptom là dấu hiệu người bệnh cảm nhận/biểu hiện; diagnosis là kết luận bệnh.",
    "diagnosis": "diagnosis là kết luận xác định bệnh sau khi khám; symptom chỉ là triệu chứng gợi ý.",
    "coverage": "Trong bảo hiểm, coverage là phạm vi các chi phí/rủi ro được bảo hiểm chi trả.",
    "claim": "Trong bảo hiểm, claim là yêu cầu công ty chi trả; không chỉ là lời khẳng định như nghĩa thông thường.",
    "premium": "Trong bảo hiểm, premium là phí bảo hiểm định kỳ; trong mua sắm premium có thể nghĩa là cao cấp.",
    "appointment": "appointment là cuộc hẹn đã ấn định; reservation thường là chỗ/phòng/bàn được giữ trước.",
    "examination": "Trong y tế, examination là việc khám/kiểm tra; trong giáo dục mới là kỳ thi.",
    "broadcast": "broad + cast: phát nội dung rộng ra nhiều người; dùng cho phát thanh, truyền hình hoặc trực tuyến.",
    "exhibit": "exhibit là vật được trưng bày hoặc hành động trưng bày; exhibition là cả cuộc triển lãm.",
    "admission": "admission là quyền/giá vào cửa; cũng có thể là sự thừa nhận, nên phải nhìn ngữ cảnh.",
    "performance": "performance là buổi/sự thể hiện; trong công việc còn là hiệu suất làm việc.",
    "audience": "audience là nhóm người xem/nghe một buổi biểu diễn hoặc nội dung truyền thông.",
    "screen": "screen là màn hình; trong điện ảnh động từ screen còn nghĩa là chiếu phim hoặc sàng lọc.",
    "rental": "rent + -al: việc/khoản thuê; rental car là xe thuê, rental fee là phí thuê.",
    "reservation": "reservation là việc giữ chỗ trước; booking gần nghĩa và thường dùng trong du lịch.",
    "accommodation": "accommodation thường chỉ nơi lưu trú; dạng số nhiều accommodations phổ biến trong tiếng Anh Mỹ.",
    "vacant": "vacant = đang trống và có thể sử dụng; occupied = đã có người dùng/ở.",
    "departure": "depart + -ure: sự khởi hành; trái với arrival là sự đến nơi.",
    "arrival": "arrive + -al: sự đến nơi; trái với departure là sự khởi hành.",
    "itinerary": "itinerary là lịch trình chi tiết gồm nơi đi và thời gian; schedule rộng hơn cho mọi loại lịch.",
    "destination": "destination là nơi chuyến đi hướng tới; origin/departure point là nơi bắt đầu.",
    "venue": "venue là địa điểm tổ chức sự kiện; location chỉ địa điểm nói chung.",
    "cater": "Trong sự kiện, cater là cung cấp đồ ăn/dịch vụ ăn uống; cater to còn nghĩa là đáp ứng nhu cầu.",
    "ingredient": "ingredient là thành phần dùng để tạo món ăn/sản phẩm; recipe là công thức hướng dẫn cách kết hợp chúng.",
    "recipe": "recipe là công thức gồm nguyên liệu và cách làm; ingredient chỉ là một thành phần.",
    "beverage": "beverage là từ trang trọng cho đồ uống; drink thông dụng hơn và còn là động từ uống.",
    "appetizer": "appetizer là món nhỏ ăn trước món chính để kích thích vị giác; entrée/main course là món chính tùy vùng.",
    "entrée": "Trong tiếng Anh Mỹ, entrée thường là món chính; trong tiếng Pháp/Anh Anh có thể gợi món vào đầu bữa.",
    "lease": "lease thường là hợp đồng thuê dài hạn có điều khoản; rent là hành động/khoản thuê nói chung.",
    "tenant": "tenant là người thuê và sử dụng bất động sản; landlord là chủ cho thuê.",
    "landlord": "land + lord: chủ sở hữu cho người khác thuê nhà/đất; đối ứng với tenant.",
    "prototype": "proto- = đầu tiên, type = mẫu; prototype là mẫu thử đầu tiên để kiểm tra ý tưởng.",
    "specification": "specification là yêu cầu/thông số chi tiết sản phẩm phải đáp ứng; thường rút gọn là specs.",
    "durable": "durable là bền, chịu được sử dụng lâu; khác lasting là kéo dài nói chung.",
    "inspect": "in- + spect (nhìn): inspect là xem xét kỹ để phát hiện vấn đề; inspection là cuộc kiểm tra.",
    "standard": "standard là mức chuẩn dùng để đánh giá; meet standards = đáp ứng tiêu chuẩn.",
    "committee": "committee là nhóm được giao xử lý một nhiệm vụ; board thường là hội đồng có quyền quản trị cao hơn.",
    "unanimous": "unanimous = tất cả cùng một ý, không có phiếu chống; khác majority là chỉ quá bán.",
    "property": "property có thể là tài sản/bất động sản hoặc đặc tính của vật; chủ đề quyết định nghĩa.",
    "premises": "premises trong kinh doanh là khu nhà/đất của công ty; thường dùng dạng số nhiều dù chỉ một địa điểm.",
}

RELATED_WORDS = {
    "allow": "Gần permit; allow thông dụng hơn, permit trang trọng và hay liên quan quy định.",
    "permit": "Gần allow nhưng permit trang trọng hơn và có thể là danh từ giấy phép.",
    "require": "Gần need nhưng require nhấn mạnh yêu cầu bắt buộc.",
    "notify": "Gần inform; notify thường là thông báo chính thức về một việc cụ thể.",
    "verify": "Gần check, nhưng verify nhấn mạnh xác nhận thông tin là đúng.",
    "confirm": "Gần verify; confirm là xác nhận điều đã dự kiến/đặt trước là chắc chắn.",
    "maintain": "Gần keep, nhưng maintain nhấn mạnh giữ ở trạng thái tốt hoặc tiếp tục duy trì.",
    "obtain": "Gần get nhưng trang trọng hơn: đạt được/nhận được sau một quá trình.",
    "select": "Gần choose nhưng trang trọng hơn, thường dùng khi chọn từ nhiều phương án.",
    "assist": "Gần help nhưng trang trọng hơn; assistance là sự hỗ trợ.",
    "request": "Gần ask for nhưng trang trọng hơn; có thể là danh từ hoặc động từ.",
    "respond": "Gần reply; respond rộng hơn, reply thường là trả lời lời nói/thư.",
    "provide": "Gần supply; provide nhấn mạnh làm cho thứ cần thiết trở nên sẵn có.",
    "purchase": "Gần buy nhưng trang trọng, thường xuất hiện trong văn bản thương mại.",
    "increase": "Trái với decrease; có thể là danh từ hoặc động từ tăng.",
    "decrease": "Trái với increase; có thể là danh từ hoặc động từ giảm.",
    "available": "Gần obtainable/free; trong TOEIC thường là có sẵn hoặc còn trống.",
    "appropriate": "Gần suitable: phù hợp với hoàn cảnh; không có nghĩa đơn thuần là đúng.",
    "approximately": "Gần about/roughly: xấp xỉ, không phải con số chính xác.",
    "immediately": "Gần at once: ngay lập tức, không trì hoãn.",
    "frequently": "Gần often: thường xuyên; mạnh hơn occasionally là thỉnh thoảng.",
    "temporarily": "Trái với permanently: chỉ trong thời gian tạm thời.",
    "mandatory": "Gần required: bắt buộc, trái với optional là tùy chọn.",
    "optional": "Trái với mandatory/required: có thể chọn làm hoặc không.",
}

# Only transparent forms are listed here; no speculative sound associations.
COMPOUNDS = {
    "overall": "over (bao trùm) + all (tất cả)",
    "forecast": "fore (trước) + cast (đưa/phóng ra)",
    "withhold": "with + hold (giữ lại)",
    "overdue": "over (vượt quá) + due (đến hạn)",
    "deadline": "dead + line (vạch cuối)",
    "workplace": "work (làm việc) + place (nơi)",
    "workforce": "work (lao động) + force (lực lượng)",
    "workload": "work (công việc) + load (khối lượng tải)",
    "paycheck": "pay (tiền công) + check (phiếu/séc)",
    "bookkeeping": "book (sổ) + keeping (ghi giữ)",
    "shareholder": "share (cổ phần) + holder (người nắm giữ)",
    "headquarters": "head (đầu não) + quarters (khu làm việc)",
    "landlord": "land (nhà/đất) + lord (chủ)",
    "roommate": "room (phòng) + mate (người cùng)",
    "workstation": "work (làm việc) + station (trạm/vị trí)",
    "keyboard": "key (phím) + board (bảng)",
    "software": "soft + ware (sản phẩm)",
    "hardware": "hard + ware (thiết bị/sản phẩm)",
    "download": "down + load (nạp dữ liệu về máy)",
    "upgrade": "up (lên) + grade (cấp)",
    "breakdown": "break + down (hỏng/ngừng hoạt động)",
    "background": "back (phía sau) + ground (nền)",
    "broadcast": "broad (rộng) + cast (phát ra)",
    "airfare": "air (hàng không) + fare (giá vé)",
    "round-trip": "round (vòng) + trip (chuyến đi): đi và về",
    "check-in": "check + in: làm thủ tục vào chuyến bay/khách sạn",
    "takeoff": "take + off: máy bay rời mặt đất",
    "stopover": "stop (dừng) + over: điểm dừng giữa hành trình",
    "outdoor": "out (bên ngoài) + door (cửa)",
    "indoor": "in (bên trong) + door (cửa)",
}

POS_HINTS = {
    "n": "danh từ",
    "v": "động từ",
    "adj": "tính từ",
    "adv": "trạng từ",
    "prep": "giới từ",
    "conj": "liên từ",
}

SUFFIX_HINTS = (
    ("tion", "đuôi -tion thường tạo danh từ chỉ sự việc/quá trình"),
    ("sion", "đuôi -sion thường tạo danh từ chỉ sự việc/quá trình"),
    ("ment", "đuôi -ment thường tạo danh từ chỉ kết quả hoặc quá trình"),
    ("ness", "đuôi -ness thường biến tính từ thành danh từ chỉ trạng thái"),
    ("ity", "đuôi -ity thường tạo danh từ chỉ tính chất/trạng thái"),
    ("ance", "đuôi -ance thường tạo danh từ"),
    ("ence", "đuôi -ence thường tạo danh từ"),
    ("able", "đuôi -able thường mang nghĩa có thể/đáng được"),
    ("ible", "đuôi -ible thường mang nghĩa có thể/đáng được"),
    ("less", "đuôi -less mang nghĩa không có/thiếu"),
    ("ful", "đuôi -ful mang nghĩa có nhiều/đầy"),
    ("ive", "đuôi -ive thường tạo tính từ"),
    ("ous", "đuôi -ous thường tạo tính từ"),
    ("ally", "đuôi -ly cho biết đây thường là trạng từ"),
    ("ically", "đuôi -ly cho biết đây thường là trạng từ"),
    ("ly", "đuôi -ly thường tạo trạng từ chỉ cách thức/tần suất"),
)

WORD_RE = re.compile(r"[A-Za-zÀ-ỹ0-9'-]+", re.UNICODE)


def compact_meaning(value: str) -> str:
    """Return a concise Vietnamese gloss without altering the source field."""
    cleaned = re.sub(r"\s+", " ", value.strip())
    return cleaned.rstrip(".;")


def pos_label(value: str) -> str:
    parts = [POS_HINTS.get(part.strip(), part.strip()) for part in value.split("/")]
    return "/".join(parts)


def example_chunk(word: str, sentence: str) -> str:
    """Extract a short, memorable chunk around the vocabulary word.

    Inflected forms are found using a conservative four-character stem. If the
    word is not present, the first meaningful six words are used.
    """
    tokens = WORD_RE.findall(sentence)
    if not tokens:
        return word

    normalized = [token.lower().strip("'-") for token in tokens]
    target = word.lower().strip()
    stem = re.sub(r"[^a-z]", "", target)[: max(4, min(7, len(target)))]

    index = -1
    for i, token in enumerate(normalized):
        token_letters = re.sub(r"[^a-z]", "", token)
        if token_letters == target or (stem and token_letters.startswith(stem)):
            index = i
            break

    if index < 0:
        start, end = 0, min(6, len(tokens))
    else:
        start, end = max(0, index - 2), min(len(tokens), index + 4)

    chunk = " ".join(tokens[start:end]).strip()
    return chunk[:1].lower() + chunk[1:] if chunk else word


def suffix_hint(word: str) -> str | None:
    lower = word.lower()
    for suffix, hint in SUFFIX_HINTS:
        if len(lower) >= len(suffix) + 3 and lower.endswith(suffix):
            return hint
    return None


def make_tip(item: dict[str, Any]) -> str:
    word = str(item.get("english", "")).strip()
    lower = word.lower()
    meaning = compact_meaning(str(item.get("vietnamese", "")))
    category = CATEGORY_VI.get(str(item.get("category", "")), str(item.get("category", "")))
    part = pos_label(str(item.get("part_of_speech", "")))
    example = str(item.get("example_sentences", {}).get("english", ""))
    chunk = example_chunk(word, example)

    if lower in SPECIAL_TIPS:
        core = SPECIAL_TIPS[lower]
    elif lower in COMPOUNDS:
        core = f"Tách từ: {COMPOUNDS[lower]}; vì vậy nghĩa trọng tâm là {meaning}."
    elif lower in RELATED_WORDS:
        core = f"{word} nghĩa là {meaning}. {RELATED_WORDS[lower]}"
    else:
        form_hint = suffix_hint(lower)
        if form_hint:
            core = f"{word} là {part}, nghĩa trọng tâm: {meaning}; {form_hint}."
        else:
            core = f"{word} là {part}, nghĩa trọng tâm: {meaning}."

    # The example chunk is taken only from the source sentence, keeping the tip
    # grounded in the user's exact data rather than an invented example.
    return f"{core} Gắn với cụm “{chunk}” trong chủ đề {category}."


def insert_after_vietnamese(item: dict[str, Any], tip: str) -> dict[str, Any]:
    result: dict[str, Any] = {}
    inserted = False
    for key, value in item.items():
        if key == "memory_tip_vi":
            continue
        result[key] = value
        if key == "vietnamese":
            result["memory_tip_vi"] = tip
            inserted = True
    if not inserted:
        result["memory_tip_vi"] = tip
    return result


def validate(original: dict[str, Any], updated: dict[str, Any]) -> None:
    before = original.get("vocabularies", [])
    after = updated.get("vocabularies", [])
    if len(before) != len(after):
        raise ValueError(f"Vocabulary count changed: {len(before)} -> {len(after)}")

    for old, new in zip(before, after, strict=True):
        if old.get("rank") != new.get("rank") or old.get("english") != new.get("english"):
            raise ValueError("Vocabulary ordering or identity changed")
        tip = new.get("memory_tip_vi")
        if not isinstance(tip, str) or len(tip.strip()) < 35:
            raise ValueError(f"Invalid memory tip at rank {new.get('rank')}")
        for key, value in old.items():
            if key != "memory_tip_vi" and new.get(key) != value:
                raise ValueError(f"Unexpected change to {key!r} at rank {new.get('rank')}")


def main() -> None:
    with DATA_PATH.open("r", encoding="utf-8") as file:
        original: dict[str, Any] = json.load(file)

    updated = json.loads(json.dumps(original, ensure_ascii=False))
    vocabularies = updated.get("vocabularies")
    if not isinstance(vocabularies, list):
        raise ValueError("Missing vocabularies array")

    updated["vocabularies"] = [
        insert_after_vietnamese(item, make_tip(item)) for item in vocabularies
    ]

    metadata = updated.setdefault("metadata", {})
    metadata["version"] = "2026-07-17"
    metadata["memory_tip_vi"] = (
        "Vietnamese learning aid grounded in meaning, transparent word formation, "
        "reliable synonym/contrast, and the source TOEIC example sentence."
    )

    # Validate vocabulary records separately because metadata is intentionally updated.
    original_for_validation = {"vocabularies": original.get("vocabularies", [])}
    updated_for_validation = {"vocabularies": updated.get("vocabularies", [])}
    validate(original_for_validation, updated_for_validation)

    with DATA_PATH.open("w", encoding="utf-8", newline="\n") as file:
        json.dump(updated, file, ensure_ascii=False, indent=2)
        file.write("\n")

    print(f"Added memory_tip_vi to {len(updated['vocabularies'])} vocabulary entries.")


if __name__ == "__main__":
    main()
