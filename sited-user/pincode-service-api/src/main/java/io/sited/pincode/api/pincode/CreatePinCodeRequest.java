package io.sited.pincode.api.pincode;

import javax.validation.constraints.NotNull;
import javax.validation.constraints.Size;
import javax.xml.bind.annotation.XmlAccessType;
import javax.xml.bind.annotation.XmlAccessorType;
import javax.xml.bind.annotation.XmlElement;

/**
 * @author chi
 */
@XmlAccessorType(XmlAccessType.FIELD)
public class CreatePinCodeRequest {
    @XmlElement(name = "email")
    public String email;

    @XmlElement(name = "phone")
    public String phone;

    @NotNull
    @Size(max = 127)
    @XmlElement(name = "ip")
    public String ip;

    @NotNull
    @Size(max = 63)
    @XmlElement(name = "requestBy")
    public String requestBy;
}
